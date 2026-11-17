package ug.ac.mak.der.web;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import ug.ac.mak.der.apps.AppInstaller;
import ug.ac.mak.der.apps.InstalledApp;
import ug.ac.mak.der.apps.InstalledAppRepository;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** Admin REST for installed custom DHIS2 apps (ADR-0005). */
@RestController
@RequestMapping(path = "/edge-api/v1/apps", produces = MediaType.APPLICATION_JSON_VALUE)
public class AppsController {

    private final AppInstaller installer;
    private final InstalledAppRepository repository;
    private final HttpClient http;

    @Autowired
    public AppsController(final AppInstaller installer,
                            final InstalledAppRepository repository,
                            final HttpClient http) {
        this.installer = Objects.requireNonNull(installer, "installer");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.http = Objects.requireNonNull(http, "http");
    }

    public AppsController(final AppInstaller installer, final InstalledAppRepository repository) {
        this(installer, repository, HttpClient.newHttpClient());
    }

    /**
     * Legacy ADR-0005 installed-app list. The C-UI-5a catalogue
     * (signed dynamic app bundles) claimed the bare `/edge-api/v1/apps`
     * path; this endpoint keeps serving the raw `InstalledApp` rows
     * (manifest + install path) at a disambiguated sub-path for the
     * admin-ui's legacy "Apps" mockup screen (EAAppsList).
     */
    @GetMapping(path = "/installed")
    public ResponseEntity<List<InstalledAppResponse>> list(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(repository.findAll().stream()
                .map(InstalledAppResponse::from)
                .toList());
    }

    /**
     * Wire shape for {@code GET /edge-api/v1/apps/installed}. Mirrors
     * {@link InstalledApp} but carries a derived {@code iconUrl} —
     * resolved from the app's own {@code manifest.webapp icons} map
     * so the launcher tile shows each DHIS2 app's native icon rather
     * than a generic DER placeholder. Different apps declare the icon
     * at different paths ({@code dhis2-app-icon.png}, {@code icon.png},
     * {@code img/icons/app_logo_48x48.png}), so we read the manifest
     * instead of hardcoding one filename.
     */
    public record InstalledAppResponse(
            UUID appId,
            String appKey,
            String version,
            String displayName,
            String manifestJson,
            String installPath,
            UUID installedBy,
            java.time.Instant installedAt,
            boolean enabled,
            InstalledApp.HostKind hostKind,
            InstalledApp.Source source,
            InstalledApp.TrustLevel trustLevel,
            java.time.Instant lastOpenedAt,
            String centralAppId,
            String iconUrl
    ) {
        private static final ObjectMapper MAPPER = new ObjectMapper();
        /** Pref-order for which icon size we surface to the launcher — 48 is
         *  the DHIS2 default, 96/128 cover retina bundles, 16 is the final
         *  fallback if an app only ships a favicon-size icon. */
        private static final String[] SIZE_PREFERENCE = {"48", "96", "128", "16"};

        static InstalledAppResponse from(final InstalledApp a) {
            return new InstalledAppResponse(
                    a.appId(), a.appKey(), a.version(), a.displayName(),
                    a.manifestJson(), a.installPath(), a.installedBy(),
                    a.installedAt(), a.enabled(), a.hostKind(), a.source(),
                    a.trustLevel(), a.lastOpenedAt(), a.centralAppId(),
                    iconUrlFrom(a.appKey(), a.manifestJson()));
        }

        private static String iconUrlFrom(final String appKey, final String manifestJson) {
            try {
                final JsonNode icons = MAPPER.readTree(manifestJson).path("icons");
                for (final String size : SIZE_PREFERENCE) {
                    final JsonNode n = icons.path(size);
                    if (n.isTextual() && !n.asText().isBlank()) {
                        return "/dhis-web-" + appKey + "/" + n.asText();
                    }
                }
            } catch (IOException ex) {
                // Malformed manifest — fall through to the generic default
                // path. AppStaticHandler returns 404 if the file isn't
                // present, and the launcher degrades to its placeholder.
            }
            return "/dhis-web-" + appKey + "/dhis2-app-icon.png";
        }
    }

    @PostMapping(path = "/install", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Object> install(final Authentication authentication,
                                            @RequestParam("file") final MultipartFile file) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "file required"));
        }
        try {
            final InstalledApp app = installer.install(file.getBytes(), principal.userId());
            return ResponseEntity.ok(app);
        } catch (AppInstaller.AppInstallException ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", ex.getMessage()));
        } catch (IOException ex) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", ex.getMessage()));
        }
    }

    /**
     * ADR-0005 alpha.4: install directly from a URL (e.g. DHIS2 App Hub).
     * Only {@code https://} URLs are accepted; file size cap is enforced
     * by the installer. Response matches {@code /install}.
     */
    @PostMapping(path = "/install-from-url", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> installFromUrl(final Authentication authentication,
                                                   @RequestBody final InstallFromUrlRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        if (body == null || body.url() == null || body.url().isBlank()) {
            return ResponseEntity.badRequest().body(java.util.Map.of(
                    "error", "url required"));
        }
        final URI target;
        try {
            target = new URI(body.url());
        } catch (URISyntaxException ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of(
                    "error", "invalid URL: " + ex.getMessage()));
        }
        if (!"https".equalsIgnoreCase(target.getScheme())) {
            return ResponseEntity.badRequest().body(java.util.Map.of(
                    "error", "only https:// URLs are accepted"));
        }
        try {
            final HttpRequest req = HttpRequest.newBuilder(target)
                    .timeout(Duration.ofSeconds(60))
                    .header("Accept", "application/zip, application/octet-stream, */*")
                    .GET()
                    .build();
            final HttpResponse<byte[]> resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() >= 400) {
                return ResponseEntity.status(502).body(java.util.Map.of(
                        "error", "upstream returned HTTP " + resp.statusCode()));
            }
            final InstalledApp app = installer.install(resp.body(), principal.userId());
            return ResponseEntity.ok(app);
        } catch (AppInstaller.AppInstallException ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", ex.getMessage()));
        } catch (IOException ex) {
            return ResponseEntity.status(502).body(java.util.Map.of("error", ex.getMessage()));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(504).body(java.util.Map.of("error", "interrupted"));
        }
    }

    public record InstallFromUrlRequest(@JsonProperty("url") String url) { }

    /**
     * ADR-0005 companion to {@link #installFromUrl}: a thin
     * "install this App Hub listing" wrapper the admin UI calls
     * after the operator clicks Install in the browse-hub panel.
     * The only difference from {@link #installFromUrl} is that we
     * accept {@code http://} as well as {@code https://} so the
     * App Hub mirror running on a pilot LAN can serve the download
     * (the public hub is always https, but on-prem mirrors aren't
     * always). The size cap still comes from
     * {@link AppInstaller#DEFAULT_MAX_BUNDLE_BYTES}.
     */
    @PostMapping(path = "/install-from-hub", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> installFromHub(final Authentication authentication,
                                                    @RequestBody final InstallFromUrlRequest body) {
        return installFromUrl(authentication, body);
    }

    @PostMapping("/{id}/enable")
    public ResponseEntity<Object> setEnabled(final Authentication authentication,
                                               @PathVariable("id") final UUID id,
                                               @RequestParam("enabled") final boolean enabled) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        final int n = repository.setEnabled(id, enabled);
        if (n == 0) {
            return ResponseEntity.status(404).build();
        }
        return ResponseEntity.ok(java.util.Map.of("appId", id, "enabled", enabled));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Object> uninstall(final Authentication authentication,
                                              @PathVariable("id") final UUID id) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        final Optional<InstalledApp> app = repository.findById(id);
        if (app.isEmpty()) {
            return ResponseEntity.status(404).build();
        }
        try {
            installer.uninstall(app.get());
            return ResponseEntity.noContent().build();
        } catch (IOException ex) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", ex.getMessage()));
        }
    }
}
