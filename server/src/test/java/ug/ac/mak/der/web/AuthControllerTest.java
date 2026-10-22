package ug.ac.mak.der.web;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import ug.ac.mak.der.security.AuthenticationService;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityProperties;

@WebMvcTest(AuthController.class)
@ActiveProfiles("test")
@Import({TestSecurityConfig.class, AuthControllerTest.Config.class})
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthenticationService authService;

    @org.springframework.boot.test.context.TestConfiguration
    static class Config {
        @Bean
        SecurityProperties securityProperties() {
            return new SecurityProperties(
                    new SecurityProperties.Session(Duration.ofHours(1), "DER_SESSION", false, "Strict", "s"),
                    new SecurityProperties.SignIn(10, 5),
                    new SecurityProperties.Bootstrap("", ""));
        }
    }

    private static EdgeUserPrincipal mockPrincipal(final EdgeRole... roles) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.copyOf(java.util.Arrays.asList(roles)), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    @Test
    void signInSuccessSetsCookieAndReturnsIdentity() throws Exception {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        when(authService.signIn(eq("alice"), eq("hunter2"), anyString(), any()))
                .thenReturn(AuthenticationService.SignInOutcome.success(u, s, "raw-token"));

        mockMvc.perform(post("/edge-api/v1/auth/sign-in")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alice\",\"password\":\"hunter2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.roles").value(org.hamcrest.Matchers.hasItem("OPERATOR")))
                .andExpect(cookie().exists("DER_SESSION"))
                .andExpect(cookie().value("DER_SESSION", "raw-token"))
                .andExpect(cookie().httpOnly("DER_SESSION", true))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Strict")));
    }

    @Test
    void signInRateLimitedReturns429() throws Exception {
        when(authService.signIn(anyString(), anyString(), anyString(), any()))
                .thenReturn(AuthenticationService.SignInOutcome.rateLimited());
        mockMvc.perform(post("/edge-api/v1/auth/sign-in")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"a\",\"password\":\"b123456789012\"}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void signInInvalidReturns401() throws Exception {
        when(authService.signIn(anyString(), anyString(), anyString(), any()))
                .thenReturn(AuthenticationService.SignInOutcome.invalidCredentials());
        mockMvc.perform(post("/edge-api/v1/auth/sign-in")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"a\",\"password\":\"b123456789012\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void signInWithMissingFieldsReturns400() throws Exception {
        mockMvc.perform(post("/edge-api/v1/auth/sign-in")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sessionWhenAnonymousIs401() throws Exception {
        mockMvc.perform(get("/edge-api/v1/auth/session"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sessionWhenAuthenticatedReturnsIdentity() throws Exception {
        mockMvc.perform(get("/edge-api/v1/auth/session").with(authentication(mockPrincipal(EdgeRole.ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.roles").value(org.hamcrest.Matchers.hasItem("ADMIN")));
    }

    @Test
    void signOutAnonymousIs401() throws Exception {
        mockMvc.perform(post("/edge-api/v1/auth/sign-out"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void signOutAuthenticatedRevokesAndClearsCookie() throws Exception {
        final EdgeUserPrincipal p = mockPrincipal(EdgeRole.ADMIN);
        mockMvc.perform(post("/edge-api/v1/auth/sign-out").with(authentication(p)))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", containsString("DER_SESSION=")));
        verify(authService).signOut(eq(p.session().sessionId()), eq(p.userId()), anyString(), any());
    }
}
