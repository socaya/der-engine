package ug.ac.mak.der.web;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Objects;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * ADR-0033: serves the DER admin UI SPA at {@code /admin/**} from a
 * static build directory ({@code der.admin-ui.dist}, default
 * {@code admin-ui/dist} relative to the launch dir). Same-origin as
 * the DER API so the {@code DER_SESSION} cookie carries directly;
 * no CORS, no cross-origin surface.
 *
 * <p>Behaviour:
 * <ul>
 *   <li>{@code GET /admin} → 302 to {@code /admin/}.</li>
 *   <li>{@code GET /admin/} + any non-asset deep link → serves
 *     {@code index.html} so the SPA router handles it.</li>
 *   <li>{@code GET /admin/assets/<file>} → serves the file with
 *     {@code max-age=31536000, immutable} because Vite's content
 *     hashing makes the URL stable per build.</li>
 *   <li>Missing dist directory → 503 with a clear message rather than
 *     a stack trace, so operators know the admin-ui wasn't bundled
 *     in the current deployment.</li>
 * </ul>
 */
@Controller
public class AdminUiController {

    private final Path distRoot;

    public AdminUiController(
            @Value("${der.admin-ui.dist:admin-ui/dist}") final String dist) {
        this.distRoot = Paths.get(Objects.requireNonNull(dist, "dist"))
                .toAbsolutePath().normalize();
    }

    @GetMapping("/admin")
    public ResponseEntity<byte[]> rootNoSlash() {
        return ResponseEntity.status(302)
                .location(URI.create("/admin/"))
                .build();
    }

    @GetMapping("/admin/**")
    public ResponseEntity<byte[]> serve(final HttpServletRequest request) throws IOException {
        final String uri = request.getRequestURI();
        String relative = uri.length() > "/admin/".length()
                ? uri.substring("/admin/".length())
                : "";
        if (relative.isEmpty()) {
            relative = "index.html";
        }

        // Filesystem first (dev + ops override via der.admin-ui.dist).
        if (Files.isDirectory(distRoot)) {
            final Path target = distRoot.resolve(relative).toAbsolutePath().normalize();
            if (!target.startsWith(distRoot)) {
                return ResponseEntity.notFound().build();
            }
            if (Files.isRegularFile(target)) {
                return serveFileFromPath(target, relative);
            }
            if (relative.startsWith("assets/")) {
                return ResponseEntity.notFound().build();
            }
            final Path index = distRoot.resolve("index.html");
            if (Files.isRegularFile(index)) {
                return serveFileFromPath(index, "index.html");
            }
        }

        // D4: packaged dist on the classpath (Maven resource step copies
        // admin-ui/dist/ into static/admin/).
        final ResponseEntity<byte[]> cp = serveFromClasspath(relative);
        if (cp != null) {
            return cp;
        }
        if (!relative.startsWith("assets/")) {
            final ResponseEntity<byte[]> cpIndex = serveFromClasspath("index.html");
            if (cpIndex != null) {
                return cpIndex;
            }
        }

        return ResponseEntity.status(503).contentType(MediaType.APPLICATION_JSON)
                .body(("{\"code\":\"ADMIN_UI_NOT_BUILT\",\"message\":"
                        + "\"admin-ui dist not found at " + distRoot
                        + " and not packaged on the classpath; run "
                        + "`cd admin-ui && DER_ADMIN_UI_BASE=/admin/ npm run build` "
                        + "then rebuild the server JAR.\"}")
                        .getBytes());
    }

    private ResponseEntity<byte[]> serveFromClasspath(final String relative) throws IOException {
        if (relative.contains("..")) {
            return null;
        }
        final ClassPathResource r = new ClassPathResource("static/admin/" + relative);
        if (!r.exists() || !r.isReadable()) {
            return null;
        }
        try (InputStream in = r.getInputStream()) {
            final byte[] body = in.readAllBytes();
            final HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(guessContentTypeByName(relative)));
            headers.setCacheControl(cacheHeaderForName(relative));
            return ResponseEntity.ok().headers(headers).body(body);
        }
    }

    private ResponseEntity<byte[]> serveFileFromPath(final Path file, final String rel) throws IOException {
        final byte[] body = Files.readAllBytes(file);
        final HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(guessContentTypeByName(rel)));
        headers.setCacheControl(cacheHeaderForName(rel));
        return ResponseEntity.ok().headers(headers).body(body);
    }

    static String guessContentType(final Path file) {
        return guessContentTypeByName(file.getFileName().toString());
    }

    static String guessContentTypeByName(final String relative) {
        final int slash = relative.lastIndexOf('/');
        final String name = slash < 0 ? relative : relative.substring(slash + 1);
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
        if (name.endsWith(".json") || name.endsWith(".map")) {
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
        if (name.endsWith(".html")) {
            return "text/html; charset=UTF-8";
        }
        return "application/octet-stream";
    }

    private static CacheControl cacheHeaderForName(final String relative) {
        if (relative.endsWith(".html")) {
            return CacheControl.noCache();
        }
        if (relative.contains("assets/")) {
            return CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic().immutable();
        }
        return CacheControl.maxAge(java.time.Duration.ofHours(1)).cachePublic();
    }
}
