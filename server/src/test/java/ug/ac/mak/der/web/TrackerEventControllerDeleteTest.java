package ug.ac.mak.der.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.attribution.CapturedByResolver;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.SystemWorkflowService;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackerEvent;
import ug.ac.mak.der.workflows.tracker.TrackerEventRepository;
import ug.ac.mak.der.workflows.tracker.TrackerService;

/** SM-1b — DELETE on a tracker stage event must enqueue a
 *  PROGRAM_STAGE_EVENT tombstone so the drain POSTs the DELETE to
 *  central. Before this fix the edge hard-deleted with no journal
 *  signal, leaving orphans on central. */
@WebMvcTest(TrackerEventController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class TrackerEventControllerDeleteTest {

    @Autowired MockMvc mockMvc;
    @MockBean TrackerEventRepository repo;
    @MockBean EnrollmentRepository enrollments;
    @MockBean CapturedByResolver captorResolver;
    @MockBean TrackerService trackerService;
    @MockBean SystemWorkflowService systemWorkflows;
    @MockBean OperationJournalRepository journal;

    @org.springframework.boot.test.context.TestConfiguration
    static class Config {
        @org.springframework.context.annotation.Bean
        public Clock testClock() {
            return Clock.fixed(Instant.parse("2026-11-10T08:00:00Z"), ZoneOffset.UTC);
        }
        @org.springframework.context.annotation.Bean
        public ObjectMapper testJsonMapper() {
            return new ObjectMapper();
        }
    }

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.parse("2026-11-10T08:00:00Z");
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "alice", "Alice",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(),
                "h", now, now, now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private TrackerEvent event() {
        return new TrackerEvent("Evt12345678", "Enr12345678",
                "Prg12345678", "Stg12345678", "Ou112345678",
                TrackerEvent.Status.ACTIVE, LocalDate.parse("2026-11-10"),
                Map.of(), null, UUID.randomUUID(),
                Instant.parse("2026-11-10T08:00:00Z"),
                Instant.parse("2026-11-10T08:00:00Z"), 1,
                UUID.randomUUID());
    }

    @Test
    void deleteEnqueuesTombstone() throws Exception {
        when(repo.findById(anyString())).thenReturn(Optional.of(event()));

        mockMvc.perform(delete("/edge-api/v1/tracker/events/Evt12345678")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());

        final ArgumentCaptor<OperationJournalEntry> captor =
                ArgumentCaptor.forClass(OperationJournalEntry.class);
        verify(journal).insert(captor.capture());
        verify(repo).delete("Evt12345678");
        final OperationJournalEntry entry = captor.getValue();
        assertThat(entry.entityType())
                .isEqualTo(OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT);
        assertThat(entry.entityRef()).isEqualTo("Evt12345678");
        assertThat(entry.state()).isEqualTo(OperationJournalEntry.State.PENDING);
        assertThat(entry.payload().get("operation").asText()).isEqualTo("DELETE");
        assertThat(entry.payload().get("eventUid").asText()).isEqualTo("Evt12345678");
        assertThat(entry.payload().get("program").asText()).isEqualTo("Prg12345678");
    }

    @Test
    void deleteReturns404WhenEventMissing() throws Exception {
        when(repo.findById(anyString())).thenReturn(Optional.empty());

        mockMvc.perform(delete("/edge-api/v1/tracker/events/Nope12345AB")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isNotFound());
    }
}
