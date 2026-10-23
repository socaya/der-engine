package ug.ac.mak.der.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class CaptureWorkflowRepositoryTest {

    private final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private CaptureWorkflow sample(final UUID id) {
        return new CaptureWorkflow(id, "wf", CaptureWorkflow.BindingKind.DATA_SET,
                "ds1", true, 1, NOW, NOW, UUID.randomUUID(), List.of(), List.of());
    }

    @Test
    void findAllReturnsEmpty() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of());
        assertThat(new CaptureWorkflowRepository(jdbc).findAll()).isEmpty();
    }

    @Test
    void findByIdEmptyForNull() {
        assertThat(new CaptureWorkflowRepository(mock(JdbcTemplate.class))
                .findById(null)).isEmpty();
    }

    @Test
    void findByIdEmptyWhenMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new CaptureWorkflowRepository(jdbc).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findEnabledForBindingEmptyForNulls() {
        final CaptureWorkflowRepository repo = new CaptureWorkflowRepository(mock(JdbcTemplate.class));
        assertThat(repo.findEnabledForBinding(null, "x")).isEmpty();
        assertThat(repo.findEnabledForBinding(CaptureWorkflow.BindingKind.DATA_SET, null))
                .isEmpty();
        assertThat(repo.findEnabledForBinding(CaptureWorkflow.BindingKind.DATA_SET, "")).isEmpty();
    }

    @Test
    void findEnabledForBindingEmptyWhenMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), anyString(), anyString()))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new CaptureWorkflowRepository(jdbc)
                .findEnabledForBinding(CaptureWorkflow.BindingKind.DATA_SET, "ds1")).isEmpty();
    }

    @Test
    void deleteNullReturnsZero() {
        assertThat(new CaptureWorkflowRepository(mock(JdbcTemplate.class)).delete(null))
                .isZero();
    }

    @Test
    void deleteDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(id))).thenReturn(1);
        assertThat(new CaptureWorkflowRepository(jdbc).delete(id)).isEqualTo(1);
    }

    @Test
    void upsertThrowsWhenZeroRowsAffected() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any(),
                any(), any(), any())).thenReturn(0);
        assertThatThrownBy(() ->
                new CaptureWorkflowRepository(jdbc).upsert(sample(UUID.randomUUID())))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void upsertHappyPath() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any(),
                any(), any(), any())).thenReturn(1);
        final UUID id = UUID.randomUUID();
        final UUID stepId = UUID.randomUUID();
        final UUID stepId2 = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "wf",
                CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1, NOW, NOW, null,
                List.of(
                        new CaptureWorkflowStep(stepId, id, 0, "s0",
                                CaptureWorkflowStep.OwnerRole.OPERATOR, null,
                                CaptureWorkflowStep.StepKind.CAPTURE,
                                List.of(new CaptureWorkflowField(stepId, "de.coc",
                                        CaptureWorkflowField.Requirement.REQUIRED))),
                        new CaptureWorkflowStep(stepId2, id, 1, "s1",
                                CaptureWorkflowStep.OwnerRole.REVIEWER, null,
                                CaptureWorkflowStep.StepKind.REVIEW, List.of())),
                List.of(new CaptureWorkflowDependency(stepId2, stepId,
                        CaptureWorkflowDependency.Kind.COMPLETES_BEFORE)));
        assertThat(new CaptureWorkflowRepository(jdbc).upsert(w)).isSameAs(w);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("DELETE FROM der.capture_workflow_step"),
                eq(id));
    }

    @Test
    void upsertPersistsOwnerDeviceId() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any(), any(),
                any(), any())).thenReturn(1);
        when(jdbc.update(anyString(), any(), any())).thenReturn(1);
        final UUID id = UUID.randomUUID();
        final UUID stepId = UUID.randomUUID();
        final UUID deviceId = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "wf",
                CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1, NOW, NOW, null,
                List.of(new CaptureWorkflowStep(stepId, id, 0, "s0",
                        CaptureWorkflowStep.OwnerRole.OPERATOR, deviceId,
                        CaptureWorkflowStep.StepKind.CAPTURE, List.of())),
                List.of());
        new CaptureWorkflowRepository(jdbc).upsert(w);
        verify(jdbc).update(
                org.mockito.ArgumentMatchers.contains("owner_device_id"),
                eq(stepId), eq(id), eq(0), eq("s0"), eq("OPERATOR"),
                eq(deviceId), eq("CAPTURE"));
    }

    @Test
    void insertRunRequiresNonNull() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        assertThatThrownBy(() -> new CaptureWorkflowRepository(jdbc).insertRun(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void insertRunDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final CaptureWorkflowRun r = new CaptureWorkflowRun(UUID.randomUUID(),
                UUID.randomUUID(), 1, "key", null,
                CaptureWorkflowRun.State.OPEN, NOW, NOW, UUID.randomUUID());
        assertThat(new CaptureWorkflowRepository(jdbc).insertRun(r)).isSameAs(r);
    }

    @Test
    void findRunsNullReturnsEmpty() {
        assertThat(new CaptureWorkflowRepository(mock(JdbcTemplate.class)).findRuns(null))
                .isEmpty();
    }

    @Test
    void findRunByKeyNullsReturnEmpty() {
        final CaptureWorkflowRepository repo = new CaptureWorkflowRepository(mock(JdbcTemplate.class));
        assertThat(repo.findRunByKey(null, 1, "key")).isEmpty();
        assertThat(repo.findRunByKey(UUID.randomUUID(), 1, null)).isEmpty();
    }

    @Test
    void findRunByKeyEmptyWhenMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class),
                any(UUID.class), anyInt(), anyString()))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new CaptureWorkflowRepository(jdbc).findRunByKey(
                UUID.randomUUID(), 1, "key")).isEmpty();
    }

    @Test
    void runMapperReadsAllColumns() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final UUID runId = UUID.randomUUID();
        final UUID workflowId = UUID.randomUUID();
        when(rs.getObject("run_id")).thenReturn(runId);
        when(rs.getObject("workflow_id")).thenReturn(workflowId);
        when(rs.getInt("workflow_version")).thenReturn(2);
        when(rs.getString("business_key")).thenReturn("ou1/202604");
        when(rs.getObject("current_step_id")).thenReturn(null);
        when(rs.getString("state")).thenReturn("OPEN");
        when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getObject("created_by")).thenReturn(null);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(workflowId)))
                .thenAnswer(inv -> List.of(((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1)));
        final List<CaptureWorkflowRun> runs =
                new CaptureWorkflowRepository(jdbc).findRuns(workflowId);
        assertThat(runs).hasSize(1);
        assertThat(runs.get(0).runId()).isEqualTo(runId);
    }

    @Test
    void findRunNullReturnsEmpty() {
        assertThat(new CaptureWorkflowRepository(mock(JdbcTemplate.class)).findRun(null))
                .isEmpty();
    }

    @Test
    void findRunEmptyWhenMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        assertThat(new CaptureWorkflowRepository(jdbc).findRun(UUID.randomUUID()))
                .isEmpty();
    }

    @Test
    void updateRunStateHitsSql() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), anyString(), any(Timestamp.class), any(UUID.class)))
                .thenReturn(1);
        final UUID runId = UUID.randomUUID();
        assertThat(new CaptureWorkflowRepository(jdbc)
                .updateRunState(runId, CaptureWorkflowRun.State.COMPLETED, NOW)).isEqualTo(1);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("UPDATE der.capture_workflow_run"),
                eq("COMPLETED"), any(Timestamp.class), eq(runId));
    }

    @Test
    void countContributionsNullReturnsZero() {
        assertThat(new CaptureWorkflowRepository(mock(JdbcTemplate.class))
                .countContributions(null)).isZero();
    }

    @Test
    void countContributionsNullResultTreatedAsZero() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(UUID.class)))
                .thenReturn(null);
        assertThat(new CaptureWorkflowRepository(jdbc)
                .countContributions(UUID.randomUUID())).isZero();
    }

    @Test
    void countContributionsReturnsValue() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(UUID.class)))
                .thenReturn(3);
        assertThat(new CaptureWorkflowRepository(jdbc)
                .countContributions(UUID.randomUUID())).isEqualTo(3);
    }
}
