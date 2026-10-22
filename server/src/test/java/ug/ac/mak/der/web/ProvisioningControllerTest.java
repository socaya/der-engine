package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.PasswordHasher;
import ug.ac.mak.der.security.SecurityAuditRepository;

@WebMvcTest(ProvisioningController.class)
@ActiveProfiles("test")
@Import({TestSecurityConfig.class, ProvisioningControllerTest.Config.class})
class ProvisioningControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean EdgeUserRepository users;
    @MockBean PasswordHasher hasher;
    @MockBean SecurityAuditRepository audit;

    @org.springframework.boot.test.context.TestConfiguration
    static class Config {
        @Bean Clock clock() { return Clock.fixed(Instant.parse("2026-10-21T00:00:00Z"), ZoneOffset.UTC); }
    }

    private static RequestPostProcessor adminAuth() {
        final Instant now = Instant.now();
        final EdgeUser admin = new EdgeUser(UUID.randomUUID(), "admin", "Admin", EdgeUser.Origin.BOOTSTRAP, null,
                false, EnumSet.of(EdgeRole.ADMIN), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), admin.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(admin, s));
    }

    @Test
    void createUserHappyPath() throws Exception {
        when(hasher.hash(anyString())).thenReturn("verifier");
        when(users.upsert(any(), any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/edge-api/v1/provisioning/users").with(adminAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alice\",\"displayName\":\"Alice\",\"password\":\"longenoughpass!!\","
                                + "\"roles\":[\"OPERATOR\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.roles").value(org.hamcrest.Matchers.hasItem("OPERATOR")));
    }

    @Test
    void createUserRejectsSyncWorkerRole() throws Exception {
        // SYNC_WORKER passes bean validation but is rejected inside the
        // controller as a security invariant with an audit entry.
        mockMvc.perform(post("/edge-api/v1/provisioning/users").with(adminAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"evil\",\"displayName\":\"E\",\"password\":\"longenoughpass!!\","
                                + "\"roles\":[\"SYNC_WORKER\"]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createUserRejectsBogusRoleNameViaValidation() throws Exception {
        mockMvc.perform(post("/edge-api/v1/provisioning/users").with(adminAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"evil\",\"displayName\":\"E\",\"password\":\"longenoughpass!!\","
                                + "\"roles\":[\"GALAXY_BRAIN\"]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createUserRejectsShortPassword() throws Exception {
        mockMvc.perform(post("/edge-api/v1/provisioning/users").with(adminAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alice\",\"displayName\":\"A\",\"password\":\"short\","
                                + "\"roles\":[\"OPERATOR\"]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listUsersReturnsRows() throws Exception {
        when(users.findAll()).thenReturn(List.of(
                new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP, null, false,
                        EnumSet.of(EdgeRole.OPERATOR), Instant.now(), Instant.now())));
        mockMvc.perform(get("/edge-api/v1/provisioning/users").with(adminAuth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users.length()").value(1))
                .andExpect(jsonPath("$.users[0].username").value("alice"));
    }

    @Test
    void syncUsersReturns501WithExplanation() throws Exception {
        mockMvc.perform(post("/edge-api/v1/provisioning/sync-users").with(adminAuth()))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.status").value("NOT_IMPLEMENTED"))
                .andExpect(jsonPath("$.message", org.hamcrest.Matchers.containsString("Phase 05")));
    }

    @Test
    void createUserAnonymousIs401() throws Exception {
        mockMvc.perform(post("/edge-api/v1/provisioning/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alice\",\"displayName\":\"A\",\"password\":\"longenoughpass!!\","
                                + "\"roles\":[\"OPERATOR\"]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void syncUsersAnonymousIs401() throws Exception {
        mockMvc.perform(post("/edge-api/v1/provisioning/sync-users"))
                .andExpect(status().isUnauthorized());
    }
}
