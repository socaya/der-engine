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

class AppStaticHandlerTest {

    @Test
    void guessContentTypeFallbacks() {
        assertThat(AppStaticHandler.guessContentType("x.unknown"))
                .isEqualTo("application/octet-stream");
        assertThat(AppStaticHandler.guessContentType("x.js")).contains("javascript");
        assertThat(AppStaticHandler.guessContentType("x.css")).contains("css");
        assertThat(AppStaticHandler.guessContentType("x.json")).contains("json");
        assertThat(AppStaticHandler.guessContentType("x.html")).isNotEmpty();
    }

    @Test
    void serveMissingApp(@TempDir final Path tmp) throws Exception {
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.findByKey("x")).thenReturn(Optional.empty());
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/dhis-web-x/index.html");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo).serve("x", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void serveSuccess(@TempDir final Path tmp) throws Exception {
        Files.writeString(tmp.resolve("index.html"), "<html></html>");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        final InstalledApp app = new InstalledApp(UUID.randomUUID(), "x", "1", "x",
                "{}", tmp.toString(), UUID.randomUUID(), Instant.now(), true);
        when(repo.findByKey("x")).thenReturn(Optional.of(app));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/dhis-web-x/index.html");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo).serve("x", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void serveEmptyRelativeDefaultsToIndex(@TempDir final Path tmp) throws Exception {
        Files.writeString(tmp.resolve("index.html"), "<html></html>");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        final InstalledApp app = new InstalledApp(UUID.randomUUID(), "x", "1", "x",
                "{}", tmp.toString(), UUID.randomUUID(), Instant.now(), true);
        when(repo.findByKey("x")).thenReturn(Optional.of(app));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/dhis-web-x/");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo).serve("x", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void serveMissingFile(@TempDir final Path tmp) throws Exception {
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        final InstalledApp app = new InstalledApp(UUID.randomUUID(), "x", "1", "x",
                "{}", tmp.toString(), UUID.randomUUID(), Instant.now(), true);
        when(repo.findByKey("x")).thenReturn(Optional.of(app));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/dhis-web-x/missing.html");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo).serve("x", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void servePathTraversal(@TempDir final Path tmp) throws Exception {
        Files.writeString(tmp.resolve("inside.txt"), "x");
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        final InstalledApp app = new InstalledApp(UUID.randomUUID(), "x", "1", "x",
                "{}", tmp.toString(), UUID.randomUUID(), Instant.now(), true);
        when(repo.findByKey("x")).thenReturn(Optional.of(app));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/dhis-web-x/../etc/passwd");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo).serve("x", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void serveNonPrefixedUri(@TempDir final Path tmp) throws Exception {
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        final InstalledApp app = new InstalledApp(UUID.randomUUID(), "x", "1", "x",
                "{}", tmp.toString(), UUID.randomUUID(), Instant.now(), true);
        when(repo.findByKey("x")).thenReturn(Optional.of(app));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/elsewhere/x.html");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo).serve("x", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(404);
    }
}
