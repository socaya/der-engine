package ug.ac.mak.der.web;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.SyncStatusService;

@WebMvcTest(SyncStatusController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class SyncStatusControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean SyncStatusService service;

    private static RequestPostProcessor operatorAuth() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void returnsUnknownAtPhase03() throws Exception {
        when(service.statusFor("TrackedEntity", "abc12345"))
                .thenReturn(new SyncStatusService.SyncStatusResponse("TrackedEntity", "abc12345",
                        SyncStatusService.SyncStatus.UNKNOWN, "Phase 03 placeholder"));
        mockMvc.perform(get("/edge-api/v1/records/TrackedEntity/abc12345/sync-status").with(operatorAuth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entityType").value("TrackedEntity"))
                .andExpect(jsonPath("$.entityId").value("abc12345"))
                .andExpect(jsonPath("$.status").value("UNKNOWN"));
    }

    @Test
    void anonymousIs401() throws Exception {
        mockMvc.perform(get("/edge-api/v1/records/Event/x/sync-status"))
                .andExpect(status().isUnauthorized());
    }
}
