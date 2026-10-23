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

class AppStaticHandlerCspTest {

    private static InstalledApp app(final Path installPath) {
        return new InstalledApp(UUID.randomUUID(), "foo", "1.0", "Foo",
                "{\"name\":\"Foo\",\"version\":\"1.0\"}", installPath.toString(),
                UUID.randomUUID(), Instant.parse("2026-10-23T00:00:00Z"), true);
    }

    private static HttpServletRequest req(final String uri) {
        final HttpServletRequest r = mock(HttpServletRequest.class);
        when(r.getRequestURI()).thenReturn(uri);
        return r;
    }

    @Test
    void cspDisabledByDefault(@TempDir final Path root) throws Exception {
        Files.writeString(root.resolve("index.html"), "<html><script>x</script></html>");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.findByKey("foo")).thenReturn(Optional.of(app(root)));
        final AppStaticHandler h = new AppStaticHandler(repo, false);
        final ResponseEntity<byte[]> res = h.serve("foo", req("/dhis-web-foo/"));
        assertThat(res.getHeaders().get("Content-Security-Policy")).isNull();
        assertThat(new String(res.getBody())).doesNotContain("nonce=");
    }

    @Test
    void cspEnabledInjectsNonceOnHtmlOnly(@TempDir final Path root) throws Exception {
        Files.writeString(root.resolve("index.html"),
                "<html><head><style>a{}</style></head><body><script>x</script></body></html>");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.findByKey("foo")).thenReturn(Optional.of(app(root)));
        final AppStaticHandler h = new AppStaticHandler(repo, true);
        final ResponseEntity<byte[]> res = h.serve("foo", req("/dhis-web-foo/"));
        assertThat(res.getHeaders().get("Content-Security-Policy")).isNotEmpty();
        final String body = new String(res.getBody());
        assertThat(body).contains("<script nonce=\"");
        assertThat(body).contains("<style nonce=\"");
    }

    @Test
    void cspEnabledDoesNotTouchJsAssets(@TempDir final Path root) throws Exception {
        Files.writeString(root.resolve("app.js"), "console.log('hi')");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.findByKey("foo")).thenReturn(Optional.of(app(root)));
        final AppStaticHandler h = new AppStaticHandler(repo, true);
        final ResponseEntity<byte[]> res = h.serve("foo", req("/dhis-web-foo/app.js"));
        assertThat(res.getHeaders().get("Content-Security-Policy")).isNull();
        assertThat(new String(res.getBody())).isEqualTo("console.log('hi')");
    }

    @Test
    void injectNonceAddsAttributeOnEveryTag() {
        final byte[] out = AppStaticHandler.injectNonce(
                "<script src=\"a.js\"></script><style>a{}</style>".getBytes(),
                "nonce-abc");
        final String s = new String(out);
        assertThat(s).isEqualTo(
                "<script nonce=\"nonce-abc\" src=\"a.js\"></script>"
                        + "<style nonce=\"nonce-abc\">a{}</style>");
    }
}
