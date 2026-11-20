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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.ResponseEntity;

class AppStaticHandlerTest {

    @BeforeEach
    void authStub() {
        AppStaticHandlerTestAuth.authenticate();
    }

    @AfterEach
    void authClear() {
        AppStaticHandlerTestAuth.clear();
    }

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
        final InstalledApp app = InstalledApp.legacy(UUID.randomUUID(), "x", "1", "x",
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
        final InstalledApp app = InstalledApp.legacy(UUID.randomUUID(), "x", "1", "x",
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
        final InstalledApp app = InstalledApp.legacy(UUID.randomUUID(), "x", "1", "x",
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
        final InstalledApp app = InstalledApp.legacy(UUID.randomUUID(), "x", "1", "x",
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
        final InstalledApp app = InstalledApp.legacy(UUID.randomUUID(), "x", "1", "x",
                "{}", tmp.toString(), UUID.randomUUID(), Instant.now(), true);
        when(repo.findByKey("x")).thenReturn(Optional.of(app));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/elsewhere/x.html");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo).serve("x", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(404);
    }

    // DER-APPS-DHIS2-001 Phase 5d — DHIS2_IFRAME serving reads entries
    // out of the zip stored in installed_app_version.bundle_bytes.

    private static byte[] zipOf(final java.util.Map<String, byte[]> entries)
            throws java.io.IOException {
        final java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        try (java.util.zip.ZipOutputStream zos = new java.util.zip.ZipOutputStream(out)) {
            for (final var e : entries.entrySet()) {
                zos.putNextEntry(new java.util.zip.ZipEntry(e.getKey()));
                zos.write(e.getValue());
                zos.closeEntry();
            }
        }
        return out.toByteArray();
    }

    private static InstalledApp iframeApp(final String key,
                                             final String version,
                                             final UUID appId) {
        return new InstalledApp(appId, key, version, key, "{}",
                "zip://" + key, UUID.randomUUID(), Instant.now(), true,
                InstalledApp.HostKind.DHIS2_IFRAME,
                InstalledApp.Source.MANUAL_UPLOAD,
                InstalledApp.TrustLevel.UNSIGNED, null, null);
    }

    @Test
    void iframeServeIndexHtmlFromZip() throws Exception {
        final UUID appId = UUID.randomUUID();
        final byte[] zip = zipOf(java.util.Map.of(
                "index.html", "<html>stock</html>".getBytes(),
                "app.js", "console.log('ok')".getBytes()));
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        final AppCatalogueRepository cat = mock(AppCatalogueRepository.class);
        when(repo.findByKey("stock")).thenReturn(Optional.of(
                iframeApp("stock", "1.0", appId)));
        when(cat.readBundle(appId, "1.0")).thenReturn(Optional.of(
                new AppCatalogueRepository.BundleRow(zip, "sha", null, "0")));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/dhis-web-stock/index.html");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo, cat)
                .serve("stock", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(200);
        // AppStaticHandler stamps a HeaderBar-hide <style> block
        // on every HTML serve so operators see consistent DER
        // chrome across every DHIS2 app. Assert the prefix + the
        // app's own body, rather than equality.
        assertThat(new String(resp.getBody()))
                .endsWith("<html>stock</html>")
                .contains("__der_hide_dhis2_headerbar__");
    }

    @Test
    void iframeServeNestedEntryFromZip() throws Exception {
        final UUID appId = UUID.randomUUID();
        final byte[] zip = zipOf(java.util.Map.of(
                "index.html", "<html></html>".getBytes(),
                "assets/css/app.css", "body{}".getBytes()));
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        final AppCatalogueRepository cat = mock(AppCatalogueRepository.class);
        when(repo.findByKey("stock")).thenReturn(Optional.of(
                iframeApp("stock", "1.0", appId)));
        when(cat.readBundle(appId, "1.0")).thenReturn(Optional.of(
                new AppCatalogueRepository.BundleRow(zip, "sha", null, "0")));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/dhis-web-stock/assets/css/app.css");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo, cat)
                .serve("stock", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(resp.getBody())).isEqualTo("body{}");
    }

    @Test
    void iframeServeMissingEntryReturns404() throws Exception {
        final UUID appId = UUID.randomUUID();
        final byte[] zip = zipOf(java.util.Map.of(
                "index.html", "<html></html>".getBytes()));
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        final AppCatalogueRepository cat = mock(AppCatalogueRepository.class);
        when(repo.findByKey("stock")).thenReturn(Optional.of(
                iframeApp("stock", "1.0", appId)));
        when(cat.readBundle(appId, "1.0")).thenReturn(Optional.of(
                new AppCatalogueRepository.BundleRow(zip, "sha", null, "0")));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/dhis-web-stock/nope.js");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo, cat)
                .serve("stock", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void iframeDoesNotRedirectTopLevelDocumentNavigation() throws Exception {
        // Phase 5d — deep-link launch model. A top-level navigation to
        // /dhis-web-<key>/ must serve index.html, not redirect to
        // /apps/<key> (which was the Phase 2 iframe-mount design).
        final UUID appId = UUID.randomUUID();
        final byte[] zip = zipOf(java.util.Map.of(
                "index.html", "<html>deeplinked</html>".getBytes()));
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        final AppCatalogueRepository cat = mock(AppCatalogueRepository.class);
        when(repo.findByKey("stock")).thenReturn(Optional.of(
                iframeApp("stock", "1.0", appId)));
        when(cat.readBundle(appId, "1.0")).thenReturn(Optional.of(
                new AppCatalogueRepository.BundleRow(zip, "sha", null, "0")));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/dhis-web-stock/");
        when(req.getHeader("Sec-Fetch-Dest")).thenReturn("document");
        final ResponseEntity<byte[]> resp = new AppStaticHandler(repo, cat)
                .serve("stock", req);
        assertThat(resp.getStatusCode().value()).isEqualTo(200);
        // HeaderBar-hide style is stamped on every HTML serve (see
        // iframeServeIndexHtmlFromZip for the rationale).
        assertThat(new String(resp.getBody()))
                .endsWith("<html>deeplinked</html>")
                .contains("__der_hide_dhis2_headerbar__");
    }
}
