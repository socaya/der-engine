package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.journal.ConflictReviewService;

@WebMvcTest(ConflictReviewController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class ConflictReviewControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ConflictReviewService service;

    private final ObjectMapper mapper = new ObjectMapper();

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private OperationJournalEntry entry(final UUID id, final OperationJournalEntry.State state) {
        return new OperationJournalEntry(id, OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "x", mapper.createObjectNode(), state, 0, null, UUID.randomUUID(),
                Instant.now(), Instant.now());
    }

    @Test
    void listRequiresAuth() throws Exception {
        mockMvc.perform(get("/edge-api/v1/journal/conflicts")).andExpect(status().isUnauthorized());
    }

    @Test
    void listReturns() throws Exception {
        when(service.listConflicts(anyInt())).thenReturn(List.of(entry(UUID.randomUUID(),
                OperationJournalEntry.State.CONFLICT_REVIEW)));
        mockMvc.perform(get("/edge-api/v1/journal/conflicts").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
    }

    @Test
    void resolveUnauthenticated() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/resolve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"ACCEPTED\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void resolveRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/resolve")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"ACCEPTED\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void resolveBadBody() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/resolve")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resolveBadOutcome() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/resolve")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"NOPE\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resolveMissing() throws Exception {
        when(service.resolve(any(), any(), any(), any())).thenReturn(Optional.empty());
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/resolve")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"ACCEPTED\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void resolveSuccess() throws Exception {
        final UUID id = UUID.randomUUID();
        when(service.resolve(any(), eq(ConflictReviewService.Outcome.REJECTED), any(), any()))
                .thenReturn(Optional.of(entry(id, OperationJournalEntry.State.CENTRAL_REJECTED)));
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + id + "/resolve")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"REJECTED\",\"rationale\":\"wrong\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void resolveConflict() throws Exception {
        when(service.resolve(any(), any(), any(), any()))
                .thenThrow(new IllegalStateException("not in review"));
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/resolve")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"ACCEPTED\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void reJournalRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/re-journal")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void reJournalUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/re-journal"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reJournalSuccess() throws Exception {
        when(service.reJournal(any(), any()))
                .thenReturn(Optional.of(entry(UUID.randomUUID(), OperationJournalEntry.State.PENDING)));
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/re-journal")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk());
    }

    @Test
    void reJournalMissing() throws Exception {
        when(service.reJournal(any(), any())).thenReturn(Optional.empty());
        mockMvc.perform(post("/edge-api/v1/journal/conflicts/" + UUID.randomUUID() + "/re-journal")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }
}
