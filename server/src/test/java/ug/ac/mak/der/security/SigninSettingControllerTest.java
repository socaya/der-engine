package ug.ac.mak.der.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.web.TestSecurityConfig;

@WebMvcTest(SigninSettingController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class SigninSettingControllerTest {

    private static final Instant NOW = Instant.parse("2026-11-06T00:00:00Z");

    @Autowired MockMvc mockMvc;
    @MockBean SigninSettingRepository repo;

    private RequestPostProcessor admin() {
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "root", "Root",
                EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.ADMIN), NOW, NOW);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h",
                NOW, NOW, NOW.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private SigninSettingRepository.Settings settings(final String etag) {
        return new SigninSettingRepository.Settings(
                "sidebar", "DER", "Welcome", "Sign in", "<p>&copy;</p>",
                etag == null ? null : "image/png", etag, UUID.randomUUID(), NOW);
    }

    // ---- GET public JSON ----------------------------------------------

    @Test
    void publicReadReflectsAllFields() throws Exception {
        when(repo.read()).thenReturn(settings("deadbeef"));
        mockMvc.perform(get("/edge-api/v1/public/signin-settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.layout").value("sidebar"))
                .andExpect(jsonPath("$.appTitle").value("DER"))
                .andExpect(jsonPath("$.hasBackground").value(true))
                .andExpect(jsonPath("$.backgroundUrl")
                        .value("/edge-api/v1/public/signin-settings/background"))
                .andExpect(jsonPath("$.backgroundEtag").value("deadbeef"));
    }

    @Test
    void publicReadOmitsBackgroundUrlWhenMissing() throws Exception {
        when(repo.read()).thenReturn(settings(null));
        mockMvc.perform(get("/edge-api/v1/public/signin-settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasBackground").value(false))
                .andExpect(jsonPath("$.backgroundUrl").isEmpty())
                .andExpect(jsonPath("$.backgroundEtag").isEmpty());
    }

    // ---- GET public background ----------------------------------------

    @Test
    void backgroundReturns404WhenUnset() throws Exception {
        when(repo.read()).thenReturn(settings(null));
        mockMvc.perform(get("/edge-api/v1/public/signin-settings/background"))
                .andExpect(status().isNotFound());
    }

    @Test
    void backgroundStreamsBytesWithEtag() throws Exception {
        when(repo.read()).thenReturn(settings("abc123"));
        when(repo.readBackground()).thenReturn("IMG".getBytes());
        mockMvc.perform(get("/edge-api/v1/public/signin-settings/background"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ETAG, "\"abc123\""))
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes("IMG".getBytes()));
    }

    @Test
    void backgroundReturns304OnMatchingEtag() throws Exception {
        when(repo.read()).thenReturn(settings("abc123"));
        mockMvc.perform(get("/edge-api/v1/public/signin-settings/background")
                        .header(HttpHeaders.IF_NONE_MATCH, "\"abc123\""))
                .andExpect(status().isNotModified())
                .andExpect(header().string(HttpHeaders.ETAG, "\"abc123\""));
        verify(repo, never()).readBackground();
    }

    @Test
    void backgroundHandlesBareEtagAndWildcard() throws Exception {
        when(repo.read()).thenReturn(settings("abc123"));
        mockMvc.perform(get("/edge-api/v1/public/signin-settings/background")
                        .header(HttpHeaders.IF_NONE_MATCH, "abc123"))
                .andExpect(status().isNotModified());
        mockMvc.perform(get("/edge-api/v1/public/signin-settings/background")
                        .header(HttpHeaders.IF_NONE_MATCH, "*"))
                .andExpect(status().isNotModified());
    }

    @Test
    void backgroundIgnoresNonMatchingEtag() throws Exception {
        when(repo.read()).thenReturn(settings("abc123"));
        when(repo.readBackground()).thenReturn("IMG".getBytes());
        mockMvc.perform(get("/edge-api/v1/public/signin-settings/background")
                        .header(HttpHeaders.IF_NONE_MATCH, "\"other\", nope"))
                .andExpect(status().isOk());
    }

    // ---- PUT admin text ------------------------------------------------

    @Test
    void putRejectsAnonymous() throws Exception {
        mockMvc.perform(put("/edge-api/v1/admin/signin-settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void putRejectsEmptyBody() throws Exception {
        mockMvc.perform(put("/edge-api/v1/admin/signin-settings")
                        .with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(""))
                // Spring returns 400 for empty body against a required @RequestBody
                .andExpect(status().isBadRequest());
    }

    @Test
    void putRejectsExplicitNullBodyAsRequired() throws Exception {
        // required=false means we hit the null-guard branch inside the controller.
        mockMvc.perform(put("/edge-api/v1/admin/signin-settings")
                        .with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("null"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("body required"));
    }

    @Test
    void putRejectsInvalidLayout() throws Exception {
        mockMvc.perform(put("/edge-api/v1/admin/signin-settings")
                        .with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"layout\":\"neon\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void putAcceptsNullLayout() throws Exception {
        when(repo.read()).thenReturn(settings(null));
        when(repo.updateText(any(), any(), any(), any(), any(), any())).thenReturn(1);
        mockMvc.perform(put("/edge-api/v1/admin/signin-settings")
                        .with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"appTitle\":\"Hi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasBackground").value(false));
        verify(repo).updateText(eq(null), eq("Hi"), eq(null), eq(null), eq(null), any(UUID.class));
    }

    @Test
    void putPersistsValidLayout() throws Exception {
        when(repo.read()).thenReturn(settings("e"));
        when(repo.updateText(any(), any(), any(), any(), any(), any())).thenReturn(1);
        mockMvc.perform(put("/edge-api/v1/admin/signin-settings")
                        .with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"layout\":\"marketing\",\"appTitle\":\"T\",\"appIntro\":\"I\","
                                + "\"submitLabel\":\"Go\",\"footerHtml\":\"<p/>\"}"))
                .andExpect(status().isOk());
        verify(repo).updateText(eq("marketing"), eq("T"), eq("I"), eq("Go"), eq("<p/>"),
                any(UUID.class));
    }

    // ---- POST admin background -----------------------------------------

    @Test
    void uploadRejectsAnonymous() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/admin/signin-settings/background")
                        .file(new MockMultipartFile("file", "x.png", "image/png", "DATA".getBytes())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void uploadRejectsEmptyFile() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/admin/signin-settings/background")
                        .file(new MockMultipartFile("file", "x.png", "image/png", new byte[0]))
                        .with(admin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadRejectsBadMime() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/admin/signin-settings/background")
                        .file(new MockMultipartFile("file", "x.gif", "image/gif",
                                "DATA".getBytes()))
                        .with(admin()))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void uploadRejectsMissingMime() throws Exception {
        // Passing a null content type reaches the "mime == null" guard.
        mockMvc.perform(multipart("/edge-api/v1/admin/signin-settings/background")
                        .file(new MockMultipartFile("file", "x.png", null,
                                "DATA".getBytes()))
                        .with(admin()))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void uploadRejectsOversize() throws Exception {
        final byte[] big = new byte[SigninSettingController.MAX_BYTES + 1];
        mockMvc.perform(multipart("/edge-api/v1/admin/signin-settings/background")
                        .file(new MockMultipartFile("file", "x.png", "image/png", big))
                        .with(admin()))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void uploadStoresAndReturnsEtag() throws Exception {
        when(repo.updateBackground(any(), anyString(), anyString(), any(UUID.class)))
                .thenReturn(1);
        mockMvc.perform(multipart("/edge-api/v1/admin/signin-settings/background")
                        .file(new MockMultipartFile("file", "x.png", "image/PNG",
                                "HELLO".getBytes()))
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bytes").value(5))
                .andExpect(jsonPath("$.mime").value("image/png"))
                .andExpect(jsonPath("$.etag").isNotEmpty());
        verify(repo).updateBackground(any(), eq("image/png"), anyString(), any(UUID.class));
    }

    @Test
    void uploadAcceptsSvg() throws Exception {
        when(repo.updateBackground(any(), anyString(), anyString(), any(UUID.class)))
                .thenReturn(1);
        mockMvc.perform(multipart("/edge-api/v1/admin/signin-settings/background")
                        .file(new MockMultipartFile("file", "x.svg", "image/svg+xml",
                                "<svg/>".getBytes()))
                        .with(admin()))
                .andExpect(status().isOk());
    }

    // ---- DELETE admin background ---------------------------------------

    @Test
    void deleteRejectsAnonymous() throws Exception {
        mockMvc.perform(delete("/edge-api/v1/admin/signin-settings/background"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteClearsAndReturns204() throws Exception {
        when(repo.clearBackground(any(UUID.class))).thenReturn(1);
        mockMvc.perform(delete("/edge-api/v1/admin/signin-settings/background")
                        .with(admin()))
                .andExpect(status().isNoContent());
        verify(repo).clearBackground(any(UUID.class));
    }

    // ---- sha256 helper -------------------------------------------------

    @Test
    void sha256HexIsStableAcrossCalls() {
        final byte[] bytes = "HELLO".getBytes();
        final String a = SigninSettingController.sha256Hex(bytes);
        final String b = SigninSettingController.sha256Hex(bytes);
        assertThatEqual(a, b);
        assertThatHex(a);
    }

    @Test
    void matchesReturnsFalseForNulls() {
        org.assertj.core.api.Assertions.assertThat(
                SigninSettingController.matches(null, "x")).isFalse();
        org.assertj.core.api.Assertions.assertThat(
                SigninSettingController.matches("x", null)).isFalse();
    }

    private static void assertThatEqual(final String a, final String b) {
        org.assertj.core.api.Assertions.assertThat(a).isEqualTo(b);
    }

    private static void assertThatHex(final String s) {
        org.assertj.core.api.Assertions.assertThat(s).matches("[0-9a-f]{64}");
    }
}
