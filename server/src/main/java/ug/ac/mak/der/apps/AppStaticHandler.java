package ug.ac.mak.der.apps;

import java.io.IOException;
import java.net.URLConnection;
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
 */
@Controller
public class AppStaticHandler {

    private final InstalledAppRepository repository;

    public AppStaticHandler(final InstalledAppRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    @GetMapping("/dhis-web-{appKey}/**")
    public ResponseEntity<byte[]> serve(@PathVariable("appKey") final String appKey,
                                          final HttpServletRequest request) throws IOException {
        final Optional<InstalledApp> app = repository.findByKey(appKey);
        if (app.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final String uri = request.getRequestURI();
        final String prefix = "/dhis-web-" + appKey + "/";
        if (!uri.startsWith(prefix)) {
            return ResponseEntity.notFound().build();
        }
        String relative = uri.substring(prefix.length());
        if (relative.isEmpty()) {
            relative = "index.html";
        }
        final Path root = Paths.get(app.get().installPath()).toAbsolutePath().normalize();
        final Path target = root.resolve(relative).toAbsolutePath().normalize();
        if (!target.startsWith(root) || !Files.isRegularFile(target)) {
            return ResponseEntity.notFound().build();
        }
        final byte[] body = Files.readAllBytes(target);
        final String contentType = guessContentType(relative);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .cacheControl(CacheControl.noCache())
                .body(body);
    }

    static String guessContentType(final String name) {
        final String guessed = URLConnection.guessContentTypeFromName(name);
        if (guessed != null) {
            return guessed;
        }
        if (name.endsWith(".js")) {
            return "application/javascript";
        }
        if (name.endsWith(".css")) {
            return "text/css";
        }
        if (name.endsWith(".json")) {
            return "application/json";
        }
        return "application/octet-stream";
    }
}
