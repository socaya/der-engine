package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.journal.JournalWorker;

@WebMvcTest(JournalWorkerController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class JournalWorkerControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean JournalWorker worker;
    @MockBean OperationJournalRepository journal;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void healthRequiresAuth() throws Exception {
        mockMvc.perform(get("/edge-api/v1/journal/worker")).andExpect(status().isUnauthorized());
    }

    @Test
    void healthOk() throws Exception {
        when(worker.enabled()).thenReturn(true);
        when(worker.lastTick()).thenReturn(Instant.now());
        when(worker.lastBatchSize()).thenReturn(3);
        when(journal.countByState(any(OperationJournalEntry.State.class))).thenReturn(0);
        mockMvc.perform(get("/edge-api/v1/journal/worker").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    void pauseRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/worker/pause").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void pauseUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/worker/pause"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void pauseOk() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/worker/pause").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk());
    }

    @Test
    void resumeRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/worker/resume").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void resumeUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/worker/resume"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void resumeOk() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/worker/resume").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk());
    }
}
