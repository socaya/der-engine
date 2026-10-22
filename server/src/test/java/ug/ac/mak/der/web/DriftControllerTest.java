package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Optional;
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
import ug.ac.mak.der.sync.drift.DriftDetectionService;
import ug.ac.mak.der.sync.drift.DriftSnapshot;

@WebMvcTest(DriftController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class DriftControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean DriftDetectionService drift;

    private RequestPostProcessor as() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void latestNoSnapshot() throws Exception {
        when(drift.latest()).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/sync/drift").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_SNAPSHOT"));
    }

    @Test
    void latestHit() throws Exception {
        when(drift.latest()).thenReturn(Optional.of(new DriftSnapshot(1L, Instant.now(),
                1L, 2L, "a", "b", "{}", "t")));
        mockMvc.perform(get("/edge-api/v1/sync/drift").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.driftId").value(1));
    }

    @Test
    void refreshRunsDetector() throws Exception {
        when(drift.recordLatestDelta(anyString()))
                .thenReturn(new DriftDetectionService.DriftReport(1L, 2L, "a", "b",
                        java.util.Map.of()));
        mockMvc.perform(get("/edge-api/v1/sync/drift?refresh=true").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshotTo").value(2));
    }

    @Test
    void anonymousIs401() throws Exception {
        mockMvc.perform(get("/edge-api/v1/sync/drift")).andExpect(status().isUnauthorized());
    }
}
