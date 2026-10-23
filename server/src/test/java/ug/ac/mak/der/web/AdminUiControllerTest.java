package ug.ac.mak.der.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.ResponseEntity;

class AdminUiControllerTest {

    private static HttpServletRequest requestFor(final String uri) {
        final HttpServletRequest r = mock(HttpServletRequest.class);
        when(r.getRequestURI()).thenReturn(uri);
        return r;
    }

    @Test
    void rootNoSlashRedirects() {
        final AdminUiController c = new AdminUiController("/nonexistent");
        final ResponseEntity<byte[]> r = c.rootNoSlash();
        assertThat(r.getStatusCode().value()).isEqualTo(302);
        assertThat(r.getHeaders().getLocation().toString()).isEqualTo("/admin/");
    }

    @Test
    void returns503OrClasspathWhenDistMissing() throws Exception {
        // D4: when the filesystem dist is absent, controller falls back
        // to the packaged classpath resource (static/admin/). The outcome
        // depends on whether the test classpath has the dist bundled —
        // either way, no stack trace should leak.
        final AdminUiController c = new AdminUiController("/no/such/dir");
        final ResponseEntity<byte[]> r = c.serve(requestFor("/admin/"));
        final int status = r.getStatusCode().value();
        assertThat(status).isIn(200, 503);
        if (status == 503) {
            assertThat(new String(r.getBody())).contains("ADMIN_UI_NOT_BUILT");
        }
    }

    @Test
    void servesIndexForRoot(@TempDir final Path tmp) throws Exception {
        Files.writeString(tmp.resolve("index.html"), "<html>hi</html>");
        final AdminUiController c = new AdminUiController(tmp.toString());
        final ResponseEntity<byte[]> r = c.serve(requestFor("/admin/"));
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(r.getBody())).contains("<html>");
        assertThat(r.getHeaders().getCacheControl()).contains("no-cache");
        assertThat(r.getHeaders().getContentType().toString()).contains("text/html");
    }

    @Test
    void servesAssetWithLongCache(@TempDir final Path tmp) throws Exception {
        Files.createDirectories(tmp.resolve("assets"));
        Files.writeString(tmp.resolve("assets/index-abc.js"), "console.log(1)");
        final AdminUiController c = new AdminUiController(tmp.toString());
        final ResponseEntity<byte[]> r = c.serve(requestFor("/admin/assets/index-abc.js"));
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(r.getHeaders().getCacheControl()).contains("max-age=31536000");
        assertThat(r.getHeaders().getCacheControl()).contains("immutable");
    }

    @Test
    void spaFallbackReturnsIndex(@TempDir final Path tmp) throws Exception {
        Files.writeString(tmp.resolve("index.html"), "<html>spa</html>");
        final AdminUiController c = new AdminUiController(tmp.toString());
        final ResponseEntity<byte[]> r = c.serve(requestFor("/admin/users/42"));
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(r.getBody())).contains("spa");
    }

    @Test
    void missingAssetReturns404(@TempDir final Path tmp) throws Exception {
        Files.writeString(tmp.resolve("index.html"), "x");
        final AdminUiController c = new AdminUiController(tmp.toString());
        final ResponseEntity<byte[]> r = c.serve(requestFor("/admin/assets/missing.js"));
        assertThat(r.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void pathTraversalRejected(@TempDir final Path tmp) throws Exception {
        Files.writeString(tmp.resolve("index.html"), "x");
        final AdminUiController c = new AdminUiController(tmp.toString());
        final ResponseEntity<byte[]> r = c.serve(requestFor("/admin/../etc/passwd"));
        assertThat(r.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void guessContentTypeFallbacks(@TempDir final Path tmp) {
        assertThat(AdminUiController.guessContentType(tmp.resolve("x.svg")))
                .isEqualTo("image/svg+xml");
        assertThat(AdminUiController.guessContentType(tmp.resolve("x.woff2")))
                .isEqualTo("font/woff2");
        assertThat(AdminUiController.guessContentType(tmp.resolve("x.mjs")))
                .contains("javascript");
        assertThat(AdminUiController.guessContentType(tmp.resolve("x.unknown")))
                .isEqualTo("application/octet-stream");
    }
}
