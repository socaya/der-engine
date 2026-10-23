package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
