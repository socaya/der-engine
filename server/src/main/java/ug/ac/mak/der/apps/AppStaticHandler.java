package ug.ac.mak.der.apps;

import java.io.IOException;
import java.net.URI;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Objects;
import java.util.Optional;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * Serves static files from an installed DHIS2 custom app at
 * {@code /dhis-web-<appKey>/**}. ADR-0005.
 *
 * <p>Alpha.3 upgrades:
 * <ul>
 *   <li>trailing-slash + no-slash both land on {@code index.html}</li>
 *   <li>disabled apps return 404 (not just absent ones)</li>
 *   <li>{@code manifest.webapp} is served from the DB-stored JSON so
 *     DHIS2 app loaders that fetch the manifest work without touching
 *     the extracted bundle</li>
 * </ul>
 */
@Controller
public class AppStaticHandler {

    private final InstalledAppRepository repository;

    public AppStaticHandler(final InstalledAppRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    @GetMapping("/dhis-web-{appKey}")
    public ResponseEntity<byte[]> rootNoSlash(@PathVariable("appKey") final String appKey) {
        return ResponseEntity.status(301)
                .location(URI.create("/dhis-web-" + appKey + "/"))
                .build();
    }

    @GetMapping("/dhis-web-{appKey}/**")
    public ResponseEntity<byte[]> serve(@PathVariable("appKey") final String appKey,
                                          final HttpServletRequest request) throws IOException {
        final Optional<InstalledApp> maybe = repository.findByKey(appKey);
        if (maybe.isEmpty() || !maybe.get().enabled()) {
            return ResponseEntity.notFound().build();
        }
        final InstalledApp app = maybe.get();
        final String uri = request.getRequestURI();
        final String prefix = "/dhis-web-" + appKey + "/";
        if (!uri.startsWith(prefix)) {
            return ResponseEntity.notFound().build();
        }
        String relative = uri.substring(prefix.length());
        if (relative.isEmpty()) {
            relative = "index.html";
        }
        if ("manifest.webapp".equals(relative)) {
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .cacheControl(CacheControl.noCache())
                    .body(app.manifestJson().getBytes(StandardCharsets.UTF_8));
        }
        final Path root = Paths.get(app.installPath()).toAbsolutePath().normalize();
        final Path target = root.resolve(relative).toAbsolutePath().normalize();
        if (!target.startsWith(root) || !Files.isRegularFile(target)) {
            return ResponseEntity.notFound().build();
        }
        final byte[] body = Files.readAllBytes(target);
        final String contentType = guessContentType(relative);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .cacheControl(cacheHeaderFor(relative))
                .body(body);
    }

    static String guessContentType(final String name) {
        final String guessed = URLConnection.guessContentTypeFromName(name);
        if (guessed != null) {
            return guessed;
        }
        if (name.endsWith(".js") || name.endsWith(".mjs")) {
            return "application/javascript";
        }
        if (name.endsWith(".css")) {
            return "text/css";
        }
        if (name.endsWith(".json")) {
            return "application/json";
        }
        if (name.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (name.endsWith(".woff2")) {
            return "font/woff2";
        }
        if (name.endsWith(".woff")) {
            return "font/woff";
        }
        return "application/octet-stream";
    }

    private static CacheControl cacheHeaderFor(final String path) {
        if (path.endsWith(".html") || path.equals("index.html")) {
            return CacheControl.noCache();
        }
        return CacheControl.maxAge(java.time.Duration.ofHours(1)).cachePublic();
    }
}
