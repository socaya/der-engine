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

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
                "1.4.0", "a1b2c3d4e5f60718", "sig==", "1.0.0");
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
                        appId, "k", "K", "{}", "1.0.0", "s", "si", "1.0.0")));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].module").isEmpty());
    }

    @Test
    void listHandlesBlankManifest() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "k", "K", "", "1.0.0", "s", "si", "1.0.0")));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].module").isEmpty());
    }

    @Test
    void listHandlesNullManifest() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "k", "K", null, "1.0.0", "s", "si", "1.0.0")));
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
                        "1.0.0", "s", "si", "1.0.0")));
        mockMvc.perform(get("/edge-api/v1/apps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apps[0].module").isEmpty());
    }

    @Test
    void listReturnsNullModuleOnMalformedManifest() throws Exception {
        final UUID appId = UUID.randomUUID();
        when(repo.catalogue()).thenReturn(List.of(
                new AppCatalogueRepository.CatalogueEntry(
                        appId, "k", "K", "{not json", "1.0.0", "s", "si", "1.0.0")));
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
        mockMvc.perform(multipart("/edge-api/v1/admin/apps/install")
                        .file(new MockMultipartFile("file", "a.zip",
                                "application/zip", "JS".getBytes()))
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
}
