package ug.ac.mak.der.apps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.ResponseEntity;

/**
 * Alpha.3 upgrades: trailing-slash fallback, manifest.webapp from DB,
 * disabled-app gating, SVG/font MIME, HTML no-cache.
 */
class AppStaticHandlerAlpha3Test {

    private static InstalledApp app(final Path installPath, final boolean enabled) {
        return new InstalledApp(UUID.randomUUID(), "foo", "1.0", "Foo",
                "{\"name\":\"Foo\",\"version\":\"1.0\",\"description\":\"test\"}",
                installPath.toString(), UUID.randomUUID(),
                Instant.parse("2026-10-23T00:00:00Z"), enabled);
    }

    private static HttpServletRequest requestFor(final String uri) {
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn(uri);
        return req;
    }

    @Test
    void serveIndexWhenPathIsTrailingSlash(@TempDir final Path root) throws Exception {
        Files.writeString(root.resolve("index.html"), "<html>hi</html>");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.findByKey("foo")).thenReturn(Optional.of(app(root, true)));
        final AppStaticHandler h = new AppStaticHandler(repo);
        final ResponseEntity<byte[]> res = h.serve("foo", requestFor("/dhis-web-foo/"));
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(res.getBody())).contains("<html>");
    }

    @Test
    void noSlashRedirectsWithSlash() {
        final AppStaticHandler h = new AppStaticHandler(mock(InstalledAppRepository.class));
        final ResponseEntity<byte[]> res = h.rootNoSlash("foo");
        assertThat(res.getStatusCode().value()).isEqualTo(301);
        assertThat(res.getHeaders().getLocation().toString()).isEqualTo("/dhis-web-foo/");
    }

    @Test
    void manifestServedFromDbNotFilesystem(@TempDir final Path root) throws Exception {
        // no manifest file on disk — endpoint must still answer from DB JSON
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.findByKey("foo")).thenReturn(Optional.of(app(root, true)));
        final AppStaticHandler h = new AppStaticHandler(repo);
        final ResponseEntity<byte[]> res = h.serve("foo",
                requestFor("/dhis-web-foo/manifest.webapp"));
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(res.getBody())).contains("\"name\":\"Foo\"");
        assertThat(res.getHeaders().getContentType().toString()).contains("application/json");
    }

    @Test
    void disabledAppReturns404(@TempDir final Path root) throws Exception {
        Files.writeString(root.resolve("index.html"), "x");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.findByKey("foo")).thenReturn(Optional.of(app(root, false)));
        final AppStaticHandler h = new AppStaticHandler(repo);
        final ResponseEntity<byte[]> res = h.serve("foo", requestFor("/dhis-web-foo/"));
        assertThat(res.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void guessContentTypeHandlesSvgAndFonts() {
        assertThat(AppStaticHandler.guessContentType("x.svg")).isEqualTo("image/svg+xml");
        assertThat(AppStaticHandler.guessContentType("x.woff2")).isEqualTo("font/woff2");
        assertThat(AppStaticHandler.guessContentType("x.woff")).isEqualTo("font/woff");
        assertThat(AppStaticHandler.guessContentType("x.mjs")).contains("javascript");
    }

    @Test
    void htmlResponseIsNoCache(@TempDir final Path root) throws Exception {
        Files.writeString(root.resolve("page.html"), "x");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.findByKey("foo")).thenReturn(Optional.of(app(root, true)));
        final AppStaticHandler h = new AppStaticHandler(repo);
        final ResponseEntity<byte[]> res = h.serve("foo",
                requestFor("/dhis-web-foo/page.html"));
        assertThat(res.getHeaders().getCacheControl()).contains("no-cache");
    }

    @Test
    void nonHtmlResponseIsCached(@TempDir final Path root) throws Exception {
        Files.writeString(root.resolve("app.js"), "console.log('ok')");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.findByKey("foo")).thenReturn(Optional.of(app(root, true)));
        final AppStaticHandler h = new AppStaticHandler(repo);
        final ResponseEntity<byte[]> res = h.serve("foo",
                requestFor("/dhis-web-foo/app.js"));
        assertThat(res.getHeaders().getCacheControl()).contains("max-age");
    }
}
