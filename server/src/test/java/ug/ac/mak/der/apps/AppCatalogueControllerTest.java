package ug.ac.mak.der.apps;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.web.TestSecurityConfig;

@WebMvcTest(AppCatalogueController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class AppCatalogueControllerTest {

    private static final Instant NOW = Instant.parse("2026-11-06T00:00:00Z");

    @Autowired MockMvc mockMvc;
    @MockBean AppCatalogueRepository repo;
    @MockBean AppSigningKeyService signer;
    @MockBean InstalledAppRepository installedApps;
    @Autowired ObjectMapper mapper;

    private RequestPostProcessor admin() {
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "root", "Root",
                EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.ADMIN), NOW, NOW);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h",
                NOW, NOW, NOW.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private AppCatalogueRepository.CatalogueEntry sample(final UUID appId) {
        return new AppCatalogueRepository.CatalogueEntry(
                appId, "data-entry", "Data Entry", "{\"module\":\"Data\"}",
                "1.4.0", "a1b2c3d4e5f60718", "sig==", "1.0.0", null);
    }

    // ---- list ----------------------------------------------------------

    @Test
    void listReturnsEnabledApps() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(sample(appId)));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].appId").value(appId.toString()))
                .andExpect(jsonPath("$.apps[0].appKey").value("data-entry"))
                .andExpect(jsonPath("$.apps[0].module").value("Data"))
                .andExpect(jsonPath("$.apps[0].version").value("1.4.0"))
                .andExpect(jsonPath("$.apps[0].bundleUrl")
                        .value("/edge-api/v1/apps/" + appId + "/1.4.0/bundle.js"))
                .andExpect(jsonPath("$.apps[0].bundleSha256").value("a1b2c3d4e5f60718"))
                .andExpect(jsonPath("$.apps[0].signatureB64").value("sig=="))
                .andExpect(jsonPath("$.apps[0].requiresDerApi").value("1.0.0"));
    }

    @Test
    void listHandlesManifestWithoutModule() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "k", "K", "{}", "1.0.0", "s", "si", "1.0.0", null)));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].module").isEmpty());
    }

    @Test
    void listHandlesBlankManifest() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "k", "K", "", "1.0.0", "s", "si", "1.0.0", null)));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].module").isEmpty());
    }

    @Test
    void listHandlesNullManifest() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "k", "K", null, "1.0.0", "s", "si", "1.0.0", null)));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].module").isEmpty());
    }

    @Test
    void listHandlesManifestWithNullModule() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "k", "K", "{\"module\":null}",
                        "1.0.0", "s", "si", "1.0.0", null)));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].module").isEmpty());
    }

    @Test
    void listReturnsNullModuleOnMalformedManifest() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "k", "K", "{not json", "1.0.0", "s", "si", "1.0.0", null)));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].module").isEmpty());
    }

    // ---- signing-key ---------------------------------------------------

    @Test
    void signingKeyReturnsPublicKey() throws Exception {
        when(signer.publicKeyBase64()).thenReturn("PUBKEYB64");
        mockMvc.perform(get("/edge-api/v1/apps/signing-key"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("Ed25519"))
                .andExpect(jsonPath("$.publicKeyB64").value("PUBKEYB64"));
    }

    // ---- bundle --------------------------------------------------------

    @Test
    void bundleReturns404WhenMissing() throws Exception {
        when(repo.readBundle(any(UUID.class), eq("1.0.0"))).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/apps/" + UUID.randomUUID() + "/1.0.0/bundle.js"))
                .andExpect(status().isNotFound());
    }

    @Test
    void bundleStreamsBytesWithEtagAndImmutableCaching() throws Exception {
        final UUID appId = UUID.randomUUID();
        final byte[] bytes = "console.log('x');".getBytes();
        when(repo.readBundle(eq(appId), eq("1.0.0"))).thenReturn(Optional.of(
                new AppCatalogueRepository.BundleRow(
                        bytes, "abcdef0123456789_EXTRA", "sig", "1.0.0")));
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/1.0.0/bundle.js"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ETAG, "\"abcdef0123456789\""))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL,
                        org.hamcrest.Matchers.containsString("immutable")))
                .andExpect(content().bytes(bytes));
    }

    @Test
    void bundleReturns304OnMatchingEtag() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.readBundle(eq(appId), eq("1.0.0"))).thenReturn(Optional.of(
                new AppCatalogueRepository.BundleRow(
                        "JS".getBytes(), "abcdef0123456789_EXTRA", "sig", "1.0.0")));
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/1.0.0/bundle.js")
                        .header(HttpHeaders.IF_NONE_MATCH, "\"abcdef0123456789\""))
                .andExpect(status().isNotModified())
                .andExpect(header().string(HttpHeaders.ETAG, "\"abcdef0123456789\""));
    }

    @Test
    void bundleAcceptsBareEtagAndWildcard() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.readBundle(eq(appId), eq("1.0.0"))).thenReturn(Optional.of(
                new AppCatalogueRepository.BundleRow(
                        "JS".getBytes(), "abcdef0123456789_EXTRA", "sig", "1.0.0")));
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/1.0.0/bundle.js")
                        .header(HttpHeaders.IF_NONE_MATCH, "abcdef0123456789"))
                .andExpect(status().isNotModified());
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/1.0.0/bundle.js")
                        .header(HttpHeaders.IF_NONE_MATCH, "*"))
                .andExpect(status().isNotModified());
    }

    @Test
    void bundleServesWhenEtagDoesNotMatch() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.readBundle(eq(appId), eq("1.0.0"))).thenReturn(Optional.of(
                new AppCatalogueRepository.BundleRow(
                        "JS".getBytes(), "abcdef0123456789_EXTRA", "sig", "1.0.0")));
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/1.0.0/bundle.js")
                        .header(HttpHeaders.IF_NONE_MATCH, "\"nope\""))
                .andExpect(status().isOk());
    }

    @Test
    void bundleEtagWithShortSha() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.readBundle(eq(appId), eq("1.0.0"))).thenReturn(Optional.of(
                new AppCatalogueRepository.BundleRow(
                        "JS".getBytes(), "short", "sig", "1.0.0")));
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/1.0.0/bundle.js"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ETAG, "\"short\""));
    }

    // ---- install -------------------------------------------------------

    @Test
    void installRejectsAnonymous() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("appKey", "k")
                        .param("displayName", "N")
                        .param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void installRejectsEmptyFile() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", new byte[0]))
                        .param("appKey", "k")
                        .param("displayName", "N")
                        .param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void installRejectsMissingMime() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js", null, "JS".getBytes()))
                        .param("appKey", "k")
                        .param("displayName", "N")
                        .param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void installRejectsBadMime() throws Exception {
        // text/plain is neither a JS MIME nor a zip MIME and the filename
        // doesn't end in .zip either — expect 415.
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.txt",
                                "text/plain", "JS".getBytes()))
                        .param("appKey", "k")
                        .param("displayName", "N")
                        .param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void installRejectsOversize() throws Exception {
        final byte[] big = new byte[AppCatalogueController.MAX_BUNDLE_BYTES + 1];
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", big))
                        .param("appKey", "k")
                        .param("displayName", "N")
                        .param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void installCreatesNewAppRow() throws Exception {
        final byte[] bytes = "console.log('x');".getBytes();
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.empty());
        doReturn(new byte[]{1, 2, 3}).when(signer).signBundle(any());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", bytes))
                        .param("appKey", "data-entry")
                        .param("displayName", "Data Entry")
                        .param("module", "Data")
                        .param("version", "1.4.0")
                        .param("requiresDerApi", "1.0.0")
                        .param("iconSvg", "<svg/>")
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appKey").value("data-entry"))
                .andExpect(jsonPath("$.version").value("1.4.0"))
                .andExpect(jsonPath("$.requiresDerApi").value("1.0.0"));
        verify(installedApps).insert(any(InstalledApp.class));
        verify(repo).installVersion(any(UUID.class), eq("1.4.0"), any(byte[].class),
                anyString(), anyString(), eq("1.0.0"), any(UUID.class));
    }

    @Test
    void installReusesExistingAppRow() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.of(
                new InstalledApp(appId, "data-entry", "1.0.0", "Data Entry",
                        "{}", "db://data-entry", UUID.randomUUID(), NOW, true)));
        doReturn(new byte[]{1, 2, 3}).when(signer).signBundle(any());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("appKey", "data-entry")
                        .param("displayName", "Data Entry")
                        .param("version", "1.4.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appId").value(appId.toString()));
        verify(installedApps, never()).insert(any());
    }

    @Test
    void installRoundTripSignatureVerifies() throws Exception {
        // Uses the real signing service so we can verify what came back.
        final AppCatalogueRepository localRepo = this.repo;
        when(installedApps.findByKey(anyString())).thenReturn(Optional.empty());
        final byte[] bytes = "roundtrip".getBytes();
        final java.security.KeyPair kp =
                java.security.KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        final java.security.Signature s1 = java.security.Signature.getInstance("Ed25519");
        s1.initSign(kp.getPrivate());
        s1.update(bytes);
        final byte[] trueSig = s1.sign();
        when(signer.signBundle(any())).thenReturn(trueSig);
        when(signer.publicKeyBase64()).thenReturn(java.util.Base64.getEncoder()
                .encodeToString(AppSigningKeyService.extractRawPublicKey(kp.getPublic())));
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", bytes))
                        .param("appKey", "k")
                        .param("displayName", "N")
                        .param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signatureB64")
                        .value(java.util.Base64.getEncoder().encodeToString(trueSig)));
        verify(localRepo).installVersion(any(), eq("1.0.0"), eq(bytes), anyString(),
                eq(java.util.Base64.getEncoder().encodeToString(trueSig)),
                eq("1.0.0"), any(UUID.class));
    }

    // ---- upgrade -------------------------------------------------------

    @Test
    void upgradeRejectsAnonymous() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/" + UUID.randomUUID() + "/upgrade")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("version", "2.0.0")
                        .param("requiresDerApi", "1.0.0"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void upgrade404WhenAppMissing() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(installedApps.findById(appId)).thenReturn(Optional.empty());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/" + appId + "/upgrade")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("version", "2.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isNotFound());
    }

    @Test
    void upgradeRejectsEmptyFile() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(installedApps.findById(appId)).thenReturn(Optional.of(
                new InstalledApp(appId, "k", "1.0", "K", "{}", "db://k",
                        UUID.randomUUID(), NOW, true)));
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/" + appId + "/upgrade")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", new byte[0]))
                        .param("version", "2.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upgradeTransitionsPriorVersion() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(installedApps.findById(appId)).thenReturn(Optional.of(
                new InstalledApp(appId, "k", "1.0", "K", "{}", "db://k",
                        UUID.randomUUID(), NOW, true)));
        doReturn(new byte[]{9, 9}).when(signer).signBundle(any());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/" + appId + "/upgrade")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("version", "2.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("2.0.0"));
        verify(repo).installVersion(eq(appId), eq("2.0.0"), any(byte[].class),
                anyString(), anyString(), eq("1.0.0"), any(UUID.class));
    }

    // ---- enable / disable ---------------------------------------------

    @Test
    void enableRejectsAnonymous() throws Exception {
        mockMvc.perform(post("/edge-api/v1/admin/apps/" + UUID.randomUUID() + "/enable"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void enableFlipsFlag() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.setEnabled(eq(appId), eq(true), any(UUID.class))).thenReturn(1);
        mockMvc.perform(post("/edge-api/v1/admin/apps/" + appId + "/enable")
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    void enable404WhenAppMissing() throws Exception {
        when(repo.setEnabled(any(UUID.class), anyBoolean(), any(UUID.class)))
                .thenReturn(0);
        mockMvc.perform(post("/edge-api/v1/admin/apps/" + UUID.randomUUID() + "/enable")
                        .with(admin()))
                .andExpect(status().isNotFound());
    }

    @Test
    void disableFlipsFlag() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.setEnabled(eq(appId), eq(false), any(UUID.class))).thenReturn(1);
        mockMvc.perform(post("/edge-api/v1/admin/apps/" + appId + "/disable")
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
    }

    // ---- delete --------------------------------------------------------

    @Test
    void deleteRejectsAnonymous() throws Exception {
        mockMvc.perform(delete("/edge-api/v1/admin/apps/" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteReturns204OnSuccess() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.deleteApp(appId)).thenReturn(1);
        mockMvc.perform(delete("/edge-api/v1/admin/apps/" + appId).with(admin()))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteReturns404WhenMissing() throws Exception {
        when(repo.deleteApp(any(UUID.class))).thenReturn(0);
        mockMvc.perform(delete("/edge-api/v1/admin/apps/" + UUID.randomUUID())
                        .with(admin()))
                .andExpect(status().isNotFound());
    }

    // ---- matches helper ------------------------------------------------

    @Test
    void matchesNullArgsReturnFalse() {
        org.assertj.core.api.Assertions.assertThat(
                AppCatalogueController.matches(null, "x")).isFalse();
        org.assertj.core.api.Assertions.assertThat(
                AppCatalogueController.matches("x", null)).isFalse();
    }

    @Test
    void sha256HexIsStable() {
        final String a = AppCatalogueController.sha256Hex("hi".getBytes());
        final String b = AppCatalogueController.sha256Hex("hi".getBytes());
        org.assertj.core.api.Assertions.assertThat(a).isEqualTo(b);
        org.assertj.core.api.Assertions.assertThat(a).matches("[0-9a-f]{64}");
    }

    @Test
    void iconMatchesNullArgsReturnFalse() {
        org.assertj.core.api.Assertions.assertThat(
                AppCatalogueController.iconMatches(null, "x")).isFalse();
        org.assertj.core.api.Assertions.assertThat(
                AppCatalogueController.iconMatches("x", null)).isFalse();
    }

    // ---- zip install ---------------------------------------------------

    /** Build a .zip in memory. Entries given in insertion order. */
    private static byte[] zipOf(final Map<String, byte[]> entries) throws Exception {
        final ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(out)) {
            for (final Map.Entry<String, byte[]> e : entries.entrySet()) {
                zos.putNextEntry(new ZipEntry(e.getKey()));
                zos.write(e.getValue());
                zos.closeEntry();
            }
        }
        return out.toByteArray();
    }

    private static Map<String, byte[]> baseZipEntries() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        final String manifest = "{\n"
                + "  \"name\": \"data-entry\",\n"
                + "  \"displayName\": \"Data entry\",\n"
                + "  \"version\": \"0.1.0-alpha.1\",\n"
                + "  \"module\": \"Data\",\n"
                + "  \"icons\": { \"128\": \"icon.svg\" },\n"
                + "  \"requires_der_api\": \"1.0.0\"\n"
                + "}";
        m.put("manifest.webapp", manifest.getBytes());
        m.put("bundle.js", "console.log('x');".getBytes());
        m.put("icon.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes());
        return m;
    }

    @Test
    void installZipRejectsMissingManifest() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("bundle.js", "JS".getBytes());
        final byte[] zip = zipOf(m);
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zip))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("missing manifest.webapp"));
    }

    @Test
    void installZipRejectsMissingBundleJs() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"k\",\"displayName\":\"K\","
                + "\"version\":\"1.0.0\",\"requires_der_api\":\"1.0.0\"}").getBytes());
        final byte[] zip = zipOf(m);
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zip))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("missing bundle.js"));
    }

    @Test
    void installZipRejectsManifestMissingName() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"displayName\":\"K\",\"version\":\"1.0.0\","
                + "\"requires_der_api\":\"1.0.0\"}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("manifest.webapp missing required field: name"));
    }

    @Test
    void installZipRejectsManifestMissingDisplayName() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"k\",\"version\":\"1.0.0\","
                + "\"requires_der_api\":\"1.0.0\"}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("manifest.webapp missing required field: displayName"));
    }

    @Test
    void installZipRejectsManifestMissingVersion() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"k\",\"displayName\":\"K\","
                + "\"requires_der_api\":\"1.0.0\"}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("manifest.webapp missing required field: version"));
    }

    @Test
    void installZipRejectsManifestMissingRequiresDerApi() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"k\",\"displayName\":\"K\","
                + "\"version\":\"1.0.0\"}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("manifest.webapp missing required field: requires_der_api"));
    }

    @Test
    void installZipRejectsMalformedManifest() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", "{not json".getBytes());
        m.put("bundle.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("malformed manifest.webapp"));
    }

    @Test
    void installZipRejectsPathTraversalEntry() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("../evil.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error",
                        org.hamcrest.Matchers.containsString("unsafe entry name")));
    }

    @Test
    void installZipRejectsOversizedArchive() throws Exception {
        final byte[] big = new byte[AppBundleArchive.MAX_ARCHIVE_BYTES + 1];
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", big))
                        .with(admin()))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void installZipRejectsTooManyEntries() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        for (int i = 0; i < AppBundleArchive.MAX_ENTRIES + 5; i++) {
            m.put("file-" + i + ".txt", "x".getBytes());
        }
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error",
                        org.hamcrest.Matchers.containsString("too many entries")));
    }

    @Test
    void installZipRejectsEntryOverPerEntryLimit() throws Exception {
        // One entry decompresses past the 5 MB per-entry cap while the
        // full archive still fits under the 10 MB envelope limit (the
        // multipart endpoint rejects >10 MB before parsing kicks in).
        // Compressing zeros gives tiny on-disk bytes, so the resulting
        // zip is comfortably under 10 MB even though the entry itself
        // is 5 MB + 1 byte decompressed.
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("blob.bin", new byte[AppBundleArchive.MAX_ENTRY_BYTES + 1]);
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error",
                        org.hamcrest.Matchers.containsString("exceeds")));
    }

    @Test
    void installZipHappyPath() throws Exception {
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.empty());
        doReturn(new byte[]{1, 2, 3}).when(signer).signBundle(any());
        final byte[] zip = zipOf(baseZipEntries());
        final String resp = mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "data-entry.zip",
                                "application/zip", zip))
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appKey").value("data-entry"))
                .andExpect(jsonPath("$.version").value("0.1.0-alpha.1"))
                .andExpect(jsonPath("$.module").value("Data"))
                .andExpect(jsonPath("$.requiresDerApi").value("1.0.0"))
                .andExpect(jsonPath("$.iconUrl",
                        org.hamcrest.Matchers.endsWith("/icon")))
                .andExpect(jsonPath("$.manifestJson",
                        org.hamcrest.Matchers.containsString("data-entry")))
                .andReturn().getResponse().getContentAsString();
        verify(installedApps).insert(any(InstalledApp.class));
        // installVersion was called with the 11-arg overload (manifest + icon present).
        verify(repo).installVersion(any(UUID.class), eq("0.1.0-alpha.1"),
                any(byte[].class), anyString(), anyString(), eq("1.0.0"),
                any(UUID.class), anyString(), any(byte[].class),
                eq("image/svg+xml"), anyString());
        org.assertj.core.api.Assertions.assertThat(resp).contains("iconUrl");
    }

    @Test
    void iconEndpointServesIconBytes() throws Exception {
        final UUID appId = UUID.randomUUID();
        final byte[] icon = "<svg/>".getBytes();
        when(repo.readIcon(eq(appId), eq("0.1.0"))).thenReturn(Optional.of(
                new AppCatalogueRepository.IconRow(icon, "image/svg+xml", "etag16-abc")));
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/0.1.0/icon"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/svg+xml"))
                .andExpect(header().string(HttpHeaders.ETAG, "\"etag16-abc\""))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL,
                        org.hamcrest.Matchers.containsString("immutable")))
                .andExpect(content().bytes(icon));
    }

    @Test
    void iconEndpoint304OnMatchingEtag() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.readIcon(eq(appId), eq("0.1.0"))).thenReturn(Optional.of(
                new AppCatalogueRepository.IconRow(
                        "<svg/>".getBytes(), "image/svg+xml", "etag16")));
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/0.1.0/icon")
                        .header(HttpHeaders.IF_NONE_MATCH, "\"etag16\""))
                .andExpect(status().isNotModified())
                .andExpect(header().string(HttpHeaders.ETAG, "\"etag16\""));
        // bare + wildcard variants.
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/0.1.0/icon")
                        .header(HttpHeaders.IF_NONE_MATCH, "etag16"))
                .andExpect(status().isNotModified());
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/0.1.0/icon")
                        .header(HttpHeaders.IF_NONE_MATCH, "*"))
                .andExpect(status().isNotModified());
    }

    @Test
    void iconEndpointServesWhenEtagDoesNotMatch() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.readIcon(eq(appId), eq("0.1.0"))).thenReturn(Optional.of(
                new AppCatalogueRepository.IconRow(
                        "<svg/>".getBytes(), "image/svg+xml", "etag16")));
        mockMvc.perform(get("/edge-api/v1/apps/" + appId + "/0.1.0/icon")
                        .header(HttpHeaders.IF_NONE_MATCH, "\"nope\""))
                .andExpect(status().isOk());
    }

    @Test
    void iconEndpoint404WhenMissing() throws Exception {
        when(repo.readIcon(any(UUID.class), eq("0.1.0"))).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/apps/" + UUID.randomUUID() + "/0.1.0/icon"))
                .andExpect(status().isNotFound());
    }

    @Test
    void installZipWithoutIconHasNullIconUrl() throws Exception {
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.empty());
        doReturn(new byte[]{1, 2, 3}).when(signer).signBundle(any());
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"data-entry\",\"displayName\":\"Data\","
                + "\"version\":\"0.1.0\",\"requires_der_api\":\"1.0.0\"}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iconUrl").isEmpty());
    }

    @Test
    void installZipReusesExistingAppRow() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.of(
                new InstalledApp(appId, "data-entry", "0.0.1", "Data",
                        "{}", "db://data-entry", UUID.randomUUID(), NOW, true)));
        doReturn(new byte[]{1, 2, 3}).when(signer).signBundle(any());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(baseZipEntries())))
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appId").value(appId.toString()));
        verify(installedApps, never()).insert(any());
    }

    @Test
    void installZipRejectsNonImageIcon() throws Exception {
        // manifest.icons points at a .bin file which is in the zip but is
        // not an accepted icon mime.
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"data-entry\",\"displayName\":\"Data\","
                + "\"version\":\"0.1.0\",\"requires_der_api\":\"1.0.0\","
                + "\"icons\":{\"128\":\"bad.bin\"}}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        m.put("bad.bin", new byte[]{1, 2, 3});
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error",
                        org.hamcrest.Matchers.containsString("must be .svg")));
    }

    @Test
    void installZipRejectsOversizedIcon() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"data-entry\",\"displayName\":\"Data\","
                + "\"version\":\"0.1.0\",\"requires_der_api\":\"1.0.0\","
                + "\"icons\":{\"128\":\"icon.png\"}}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        m.put("icon.png", new byte[AppBundleArchive.MAX_ICON_BYTES + 1]);
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void installZipRejectsBundleOverFiveMb() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"k\",\"displayName\":\"K\","
                + "\"version\":\"1.0.0\",\"requires_der_api\":\"1.0.0\"}").getBytes());
        // Per-entry cap (5 MB) is enforced during zip reading, before the
        // bundle-specific 5 MB check — so this exercises the archive-level
        // per-entry limit path.
        m.put("bundle.js", new byte[AppCatalogueController.MAX_BUNDLE_BYTES + 1]);
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void installZipAcceptsFallbackIconWithoutSizeKey() throws Exception {
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.empty());
        doReturn(new byte[]{1, 2, 3}).when(signer).signBundle(any());
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"data-entry\",\"displayName\":\"Data\","
                + "\"version\":\"0.1.0\",\"requires_der_api\":\"1.0.0\","
                // Non-numeric icon key — should still resolve, as a fallback.
                + "\"icons\":{\"primary\":\"icon.png\"}}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        m.put("icon.png", new byte[]{(byte) 0x89, 'P', 'N', 'G'});
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iconUrl",
                        org.hamcrest.Matchers.endsWith("/icon")));
    }

    @Test
    void installZipIgnoresIconEntriesNotInArchive() throws Exception {
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.empty());
        doReturn(new byte[]{1, 2, 3}).when(signer).signBundle(any());
        // icons.128 refers to a file not present in the zip — fall back
        // to no icon.
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"data-entry\",\"displayName\":\"Data\","
                + "\"version\":\"0.1.0\",\"requires_der_api\":\"1.0.0\","
                + "\"icons\":{\"128\":\"missing.svg\"}}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iconUrl").isEmpty());
    }

    @Test
    void installZipPicksLargestIcon() throws Exception {
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.empty());
        doReturn(new byte[]{1, 2, 3}).when(signer).signBundle(any());
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"data-entry\",\"displayName\":\"Data\","
                + "\"version\":\"0.1.0\",\"requires_der_api\":\"1.0.0\","
                + "\"icons\":{\"32\":\"small.svg\",\"256\":\"big.svg\","
                + "\"128\":\"mid.svg\"}}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        m.put("small.svg", "<svg id='s'/>".getBytes());
        m.put("mid.svg",   "<svg id='m'/>".getBytes());
        m.put("big.svg",   "<svg id='b'/>".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isOk());
        // repo.installVersion gets the chosen icon mime (svg).
        verify(repo).installVersion(any(UUID.class), eq("0.1.0"),
                any(byte[].class), anyString(), anyString(), eq("1.0.0"),
                any(UUID.class), anyString(), any(byte[].class),
                eq("image/svg+xml"), anyString());
    }

    @Test
    void installRawJsStillAcceptedWithNullIconUrl() throws Exception {
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.empty());
        doReturn(new byte[]{9}).when(signer).signBundle(any());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "console.log(1)".getBytes()))
                        .param("appKey", "data-entry")
                        .param("displayName", "Data Entry")
                        .param("module", "Data")
                        .param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iconUrl").isEmpty())
                .andExpect(jsonPath("$.manifestJson").isEmpty());
    }

    @Test
    void installRawJsRejectsMissingRequiredFormFields() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        // only appKey supplied — displayName, version,
                        // requiresDerApi all missing.
                        .param("appKey", "k")
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void installRawJsRejectsEachMissingFormField() throws Exception {
        // Exercise each branch of the null-field short-circuit at
        // the top of install() for the .js path.
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("appKey", "k").param("displayName", "N")
                        .param("version", "1.0.0")
                        .with(admin()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("appKey", "k").param("displayName", "N")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("appKey", "k").param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void installRawJsRejectsAppKeyMissing() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("displayName", "N").param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upgradeRawJsRejectsOnlyRequiresDerApiMissing() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(installedApps.findById(appId)).thenReturn(Optional.of(
                new InstalledApp(appId, "k", "1.0", "K", "{}", "db://k",
                        UUID.randomUUID(), NOW, true)));
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/" + appId + "/upgrade")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        .param("version", "2.0.0")
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void isZipDetectedByFilenameOnly() throws Exception {
        // No content-type, but filename ends in .zip — the archive parser
        // runs and (since the bytes aren't a real zip) returns no entries,
        // yielding a "missing manifest.webapp" 400.
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                null, "not-a-zip".getBytes()))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("missing manifest.webapp"));
    }

    @Test
    void installZipFallsBackToNoIconWhenNoPath() throws Exception {
        // icons map carries a null value — resolver skips that entry
        // and (with no other entries) falls through to IconResolution.empty().
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.empty());
        doReturn(new byte[]{1}).when(signer).signBundle(any());
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"data-entry\",\"displayName\":\"D\","
                + "\"version\":\"0.1.0\",\"requires_der_api\":\"1.0.0\","
                + "\"icons\":{\"128\":null}}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iconUrl").isEmpty());
    }

    @Test
    void installZipRejectsBlankManifestField() throws Exception {
        // Empty-string "name" exercises the isBlank() branch (not null,
        // but blank).
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"\",\"displayName\":\"K\","
                + "\"version\":\"1.0.0\",\"requires_der_api\":\"1.0.0\"}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("manifest.webapp missing required field: name"));
    }

    @Test
    void installRawJsNoFilenameFallsThroughToJs() throws Exception {
        // Filename null — isZipUpload's name == null branch; mime is JS so
        // the js path runs and succeeds.
        when(installedApps.findByKey("k")).thenReturn(Optional.empty());
        doReturn(new byte[]{1}).when(signer).signBundle(any());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", null,
                                "application/javascript", "JS".getBytes()))
                        .param("appKey", "k")
                        .param("displayName", "K")
                        .param("version", "1.0.0")
                        .param("requiresDerApi", "1.0.0")
                        .with(admin()))
                .andExpect(status().isOk());
    }

    @Test
    void installZipSecondNonNumericKeyStillChoosesFirst() throws Exception {
        // Two non-numeric keys — the resolver's "first-match wins" fallback
        // path (chosenName != null on second entry) is exercised.
        when(installedApps.findByKey("data-entry")).thenReturn(Optional.empty());
        doReturn(new byte[]{1}).when(signer).signBundle(any());
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("manifest.webapp", ("{\"name\":\"data-entry\",\"displayName\":\"D\","
                + "\"version\":\"0.1.0\",\"requires_der_api\":\"1.0.0\","
                + "\"icons\":{\"a\":\"a.svg\",\"b\":\"b.svg\"}}").getBytes());
        m.put("bundle.js", "JS".getBytes());
        m.put("a.svg", "<svg id='a'/>".getBytes());
        m.put("b.svg", "<svg id='b'/>".getBytes());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(m)))
                        .with(admin()))
                .andExpect(status().isOk());
    }

    @Test
    void upgradeFromZipSupersedesPriorVersion() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(installedApps.findById(appId)).thenReturn(Optional.of(
                new InstalledApp(appId, "data-entry", "0.0.1", "Data",
                        "{}", "db://data-entry", UUID.randomUUID(), NOW, true)));
        doReturn(new byte[]{9}).when(signer).signBundle(any());
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/" + appId + "/upgrade")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", zipOf(baseZipEntries())))
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("0.1.0-alpha.1"))
                .andExpect(jsonPath("$.iconUrl",
                        org.hamcrest.Matchers.endsWith("/icon")));
        verify(repo).installVersion(eq(appId), eq("0.1.0-alpha.1"),
                any(byte[].class), anyString(), anyString(), eq("1.0.0"),
                any(UUID.class), anyString(), any(byte[].class),
                eq("image/svg+xml"), anyString());
    }

    @Test
    void upgradeRawJsRejectsMissingVersion() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(installedApps.findById(appId)).thenReturn(Optional.of(
                new InstalledApp(appId, "k", "1.0", "K", "{}", "db://k",
                        UUID.randomUUID(), NOW, true)));
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/" + appId + "/upgrade")
                        .file(new MockMultipartFile("file", "a.js",
                                "application/javascript", "JS".getBytes()))
                        // version + requiresDerApi missing.
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listAttachesIconUrlWhenEtagPresent() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "data-entry", "Data", "{\"module\":\"Data\"}",
                        "0.1.0", "sha", "sig", "1.0.0", "etag16")));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].iconUrl")
                        .value("/edge-api/v1/apps/" + appId + "/0.1.0/icon"))
                .andExpect(jsonPath("$.apps[0].manifestJson")
                        .value("{\"module\":\"Data\"}"));
    }

    @Test
    void listOmitsIconUrlWhenEtagMissing() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "data-entry", "Data", "{}",
                        "0.1.0", "sha", "sig", "1.0.0", null)));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].iconUrl").isEmpty());
    }
}
