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

    @GetMapping
    public ResponseEntity<List<InstalledApp>> list(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(repository.findAll());
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
