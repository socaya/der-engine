package ug.ac.mak.der.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class CaptureWorkflowContributionRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    @Test
    void upsertWritesOnConflictClause() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1);
        final CaptureWorkflowContributionRepository repo =
                new CaptureWorkflowContributionRepository(jdbc);
        final UUID id = UUID.randomUUID();
        final UUID runId = UUID.randomUUID();
        final UUID stepId = UUID.randomUUID();
        repo.upsert(new CaptureWorkflowContribution(id, runId, stepId, "{\"k\":1}",
                null, null, NOW));
        verify(jdbc).update(contains("ON CONFLICT (run_id, step_id)"),
                eq(id), eq(runId), eq(stepId), eq("{\"k\":1}"), eq(null), eq(null),
                any(Timestamp.class));
    }

    @Test
    void upsertRejectsNull() {
        final CaptureWorkflowContributionRepository repo =
                new CaptureWorkflowContributionRepository(mock(JdbcTemplate.class));
        assertThatThrownBy(() -> repo.upsert(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void findByRunNullReturnsEmpty() {
        final CaptureWorkflowContributionRepository repo =
                new CaptureWorkflowContributionRepository(mock(JdbcTemplate.class));
        assertThat(repo.findByRun(null)).isEmpty();
    }

    @SuppressWarnings("unchecked")
    @Test
    void findByRunQueriesTable() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenReturn(List.of(new CaptureWorkflowContribution(UUID.randomUUID(),
                        UUID.randomUUID(), UUID.randomUUID(), "{}", null, null, NOW)));
        final CaptureWorkflowContributionRepository repo =
                new CaptureWorkflowContributionRepository(jdbc);
        assertThat(repo.findByRun(UUID.randomUUID())).hasSize(1);
    }
}
