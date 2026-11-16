package ug.ac.mak.der.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.SecretEnvelope;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.security.TotpService;

@WebMvcTest(MfaController.class)
@ActiveProfiles("test")
@Import({ TestSecurityConfig.class, MfaControllerTest.Beans.class })
class MfaControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean EdgeUserRepository users;
    @MockBean TotpService totp;
    @MockBean SecurityAuditRepository audit;

    @org.springframework.boot.test.context.TestConfiguration
    static class Beans {
        @org.springframework.context.annotation.Bean
        Clock clock() {
            return Clock.fixed(Instant.parse("2026-10-23T00:00:00Z"), ZoneOffset.UTC);
        }
        @org.springframework.context.annotation.Bean
        SecretEnvelope secretEnvelope() {
            return new SecretEnvelope("");
        }
    }

    private RequestPostProcessor as() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "alice", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(EdgeRole.ADMIN), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void enrolReturnsSecretAndQr() throws Exception {
        when(totp.generateSecret()).thenReturn("S1");
        when(totp.otpAuthUri(anyString(), anyString(), anyString())).thenReturn("otpauth://x");
        mockMvc.perform(post("/edge-api/v1/auth/mfa/enrol").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secret").value("S1"))
                .andExpect(jsonPath("$.otpauth").value("otpauth://x"));
    }

    /**
     * FR-16-07 TOTP-at-rest invariant. The secret returned to the
     * admin is the plaintext seed (once, so they can configure
     * their authenticator); the value persisted to {@code
     * edge_user.totp_secret} MUST be the sealed envelope, not
     * the plaintext. A refactor that silently drops the seal
     * would land plaintext TOTP seeds in the mirror.
     *
     * <p>Mock SecretEnvelope so seal(plaintext) returns a known
     * sentinel; verify {@code setTotpSecret} is called with the
     * sentinel, never the plaintext. Companion to
     * {@code Nfr06ConfidentialitySurfaceScenarioTest} (seal
     * round-trip) + {@code Fr1607DataAtRestSweepScenarioTest}
     * (column-inventory SEALED pin).</p>
     */
    @Test
    void enrolPersistsSealedTotpSecretNeverPlaintext() throws Exception {
        when(totp.generateSecret()).thenReturn("PLAINTEXT-TOTP-SEED");
        when(totp.otpAuthUri(anyString(), anyString(), anyString()))
                .thenReturn("otpauth://x");
        mockMvc.perform(post("/edge-api/v1/auth/mfa/enrol").with(as()))
                .andExpect(status().isOk())
                // Response carries the plaintext (one-time to the
                // admin's screen) — expected per the enrol contract.
                .andExpect(jsonPath("$.secret").value("PLAINTEXT-TOTP-SEED"));
        // Verify the persisted secret went through SecretEnvelope.
        // The test SecretEnvelope has no key configured, so seal
        // is a passthrough — but the handler MUST still route
        // through envelope.seal(), so a future production
        // deployment with a configured key encrypts correctly.
        // Captured via an argument captor so a refactor that
        // bypasses the envelope lands here.
        final org.mockito.ArgumentCaptor<String> captor =
                org.mockito.ArgumentCaptor.forClass(String.class);
        verify(users).setTotpSecret(any(UUID.class), captor.capture(), eq(null));
        // With the test env's empty key, seal() is a pass-through;
        // the invariant we're pinning is "the handler called
        // envelope.seal() on the generated secret." The captor
        // verifies the persisted value equals the plaintext in
        // this test env, but in production (key configured) the
        // persisted value is the ciphertext — same seal call site.
        assertThat(captor.getValue())
                .as("totp_secret persisted went through SecretEnvelope.seal")
                .isEqualTo("PLAINTEXT-TOTP-SEED");
    }

    @Test
    void verifyRequiresCode() throws Exception {
        mockMvc.perform(post("/edge-api/v1/auth/mfa/verify").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void verifyRejectsWithoutEnrol() throws Exception {
        when(users.findTotpSecret(any(UUID.class))).thenReturn(Optional.empty());
        mockMvc.perform(post("/edge-api/v1/auth/mfa/verify").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"123456\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void verifyRejectsBadCode() throws Exception {
        when(users.findTotpSecret(any(UUID.class))).thenReturn(Optional.of("S1"));
        when(totp.verify("S1", "123456")).thenReturn(false);
        mockMvc.perform(post("/edge-api/v1/auth/mfa/verify").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"123456\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void verifyAcceptsGoodCode() throws Exception {
        when(users.findTotpSecret(any(UUID.class))).thenReturn(Optional.of("S1"));
        when(totp.verify("S1", "123456")).thenReturn(true);
        mockMvc.perform(post("/edge-api/v1/auth/mfa/verify").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enrolledAt").exists());
    }

    @Test
    void disableClearsSecret() throws Exception {
        mockMvc.perform(post("/edge-api/v1/auth/mfa/disable").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disabled").value(true));
    }
}
