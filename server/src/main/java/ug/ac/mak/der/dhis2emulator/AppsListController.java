package ug.ac.mak.der.dhis2emulator;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.apps.InstalledApp;
import ug.ac.mak.der.apps.InstalledAppRepository;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2-compatible {@code GET /api/apps} — lists installed custom
 * apps so DHIS2 app-loaders (and the DER launcher) can discover them.
 * ADR-0005 + alpha.3 upgrade.
 *
 * <p>Shape matches DHIS2 2.44 so stock {@code @dhis2/app-runtime}
 * clients can discover apps without special-casing DER. Only enabled
 * apps are returned.</p>
 */
@RestController
@RequestMapping(path = "/api/apps", produces = MediaType.APPLICATION_JSON_VALUE)
public class AppsListController {

    private final InstalledAppRepository repository;
    private final ObjectMapper mapper;

    public AppsListController(final InstalledAppRepository repository,
                                final ObjectMapper mapper) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(final Authentication authentication,
                                                            final HttpServletRequest request) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final String base = baseUrl(request);
        final List<Map<String, Object>> out = new ArrayList<>();
        for (final InstalledApp app : repository.findAll()) {
            if (!app.enabled()) {
                continue;
            }
            out.add(toDhis2Shape(app, base));
        }
        return ResponseEntity.ok(out);
    }

    private Map<String, Object> toDhis2Shape(final InstalledApp app, final String base) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("key", app.appKey());
        out.put("name", app.displayName());
        out.put("shortName", app.appKey());
        out.put("version", app.version());
        out.put("appType", "APP");
        final String appBase = base + "/dhis-web-" + app.appKey();
        out.put("baseUrl", appBase);
        out.put("launchUrl", appBase + "/index.html");
        out.put("appHubId", null);
        out.put("installedAt", app.installedAt().toString());
        try {
            final JsonNode manifest = mapper.readTree(app.manifestJson());
            if (manifest.has("description")) {
                out.put("description", manifest.get("description").asText());
            }
            if (manifest.has("developer")) {
                out.put("developer", mapper.convertValue(manifest.get("developer"), Map.class));
            }
            if (manifest.has("icons")) {
                out.put("icons", mapper.convertValue(manifest.get("icons"), Map.class));
            }
            if (manifest.has("activities")) {
                out.put("activities", mapper.convertValue(manifest.get("activities"), Map.class));
            }
        } catch (IOException ignored) {
            // manifest unparseable — serve the core identity only.
        }
        return out;
    }

    private static String baseUrl(final HttpServletRequest req) {
        final StringBuilder sb = new StringBuilder();
        sb.append(req.getScheme()).append("://").append(req.getServerName());
        final int port = req.getServerPort();
        final boolean defaultPort = ("http".equals(req.getScheme()) && port == 80)
                || ("https".equals(req.getScheme()) && port == 443);
        if (!defaultPort) {
            sb.append(':').append(port);
        }
        return sb.toString();
    }
}
