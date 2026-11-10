package ug.ac.mak.der.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
import ug.ac.mak.der.workflows.aggregate.DatasetCompletionRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/** SM-1a — DatasetCompletion mark() must enqueue a journal entry
 *  so the central-sync drain POSTs the completion marker. Before
 *  this test suite there was no journal insertion for completions. */
@WebMvcTest(DatasetCompletionController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class DatasetCompletionControllerSyncTest {

    @Autowired MockMvc mockMvc;
    @MockBean DatasetCompletionRepository repo;
    @MockBean OperationJournalRepository journal;

    private final ObjectMapper mapper = new ObjectMapper();

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

    @Test
    void markEnqueuesJournalEntry() throws Exception {
        final Instant now = Instant.parse("2026-11-10T08:00:00Z");
        final UUID userId = UUID.randomUUID();
        when(repo.upsert(anyString(), anyString(), anyString(), any(),
                any(Boolean.class), any(), any()))
                .thenReturn(new DatasetCompletionRepository.Record(
                        "ds1", "ouA", "202611", null, true, userId, now));

        mockMvc.perform(post("/edge-api/v1/aggregate/completion")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dataSet\":\"ds1\",\"orgUnit\":\"ouA\","
                                + "\"period\":\"202611\",\"completed\":true}"))
                .andExpect(status().isOk());

        final ArgumentCaptor<OperationJournalEntry> captor =
                ArgumentCaptor.forClass(OperationJournalEntry.class);
        verify(journal).insert(captor.capture());
        final OperationJournalEntry entry = captor.getValue();
        assertThat(entry.entityType())
                .isEqualTo(OperationJournalEntry.EntityType.AGGREGATE_DATASET_COMPLETION);
        assertThat(entry.entityRef()).isEqualTo("ds1|202611|ouA|");
        assertThat(entry.state()).isEqualTo(OperationJournalEntry.State.PENDING);
        assertThat(entry.payload().get("dataSet").asText()).isEqualTo("ds1");
        assertThat(entry.payload().get("period").asText()).isEqualTo("202611");
        assertThat(entry.payload().get("orgUnit").asText()).isEqualTo("ouA");
        assertThat(entry.payload().get("completed").asBoolean()).isTrue();
        assertThat(entry.payload().get("storedBy").asText()).isEqualTo("alice");
    }

    @Test
    void markRejectsMissingFields() throws Exception {
        mockMvc.perform(post("/edge-api/v1/aggregate/completion")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dataSet\":\"ds1\"}"))
                .andExpect(status().isBadRequest());
    }
}
