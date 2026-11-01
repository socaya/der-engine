package ug.ac.mak.der.workflow;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * §2.3.60 — reads + writes for the append-only step state transition
 * log introduced in V067. Writes come from {@link WorkflowRunCoordinator}
 * on every readiness recomputation; reads back wait + turnaround
 * percentiles grouped by step for {@code GET /workflows/metrics}.
 */
@Repository
public class CaptureWorkflowStepTransitionRepository {

    private final JdbcTemplate jdbc;

    public CaptureWorkflowStepTransitionRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Last known readiness state for a given (run, step) — null if
     *  no transition row yet. Used to decide whether a new transition
     *  should be inserted. */
    public WorkflowRunCoordinator.Readiness lastKnownState(final UUID runId,
            final UUID stepId) {
        final List<String> rows = jdbc.queryForList(
                "SELECT to_state FROM der.capture_workflow_step_transition "
                        + "WHERE run_id = ? AND step_id = ? "
                        + "ORDER BY transitioned_at DESC, transition_id DESC LIMIT 1",
                String.class, runId, stepId);
        if (rows.isEmpty()) {
            return null;
        }
        return WorkflowRunCoordinator.Readiness.valueOf(rows.get(0));
    }

    public void insert(final CaptureWorkflowStepTransition t) {
        jdbc.update(
                "INSERT INTO der.capture_workflow_step_transition "
                        + "(workflow_id, run_id, step_id, from_state, to_state, "
                        + " transitioned_at, actor_device_id, actor_user_id) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                t.workflowId(), t.runId(), t.stepId(),
                t.fromState() == null ? null : t.fromState().name(),
                t.toState().name(),
                java.sql.Timestamp.from(t.transitionedAt()),
                t.actorDeviceId(), t.actorUserId());
    }

    /** Per-step metrics over a trailing window.
     *
     *  <p>For each step that has at least one transition in the window:
     *  <ul>
     *    <li><b>turnaround</b> — milliseconds between the step entering
     *        READY and transitioning to COMPLETE on the same run</li>
     *    <li><b>completedCount</b> — number of completions in the window</li>
     *  </ul>
     */
    public List<StepMetric> stepMetrics(final Duration window) {
        final Instant since = Instant.now().minus(window);
        final String sql =
                "WITH pairs AS ("
              + "  SELECT c.workflow_id, c.run_id, c.step_id, "
              + "    (SELECT MAX(r.transitioned_at) "
              + "       FROM der.capture_workflow_step_transition r "
              + "      WHERE r.run_id = c.run_id AND r.step_id = c.step_id "
              + "        AND r.to_state = 'READY' AND r.transitioned_at <= c.transitioned_at) AS ready_at, "
              + "    c.transitioned_at AS complete_at "
              + "  FROM der.capture_workflow_step_transition c "
              + "  WHERE c.to_state = 'COMPLETE' AND c.transitioned_at >= ?) "
              + "SELECT workflow_id, step_id, "
              + "       COUNT(*)::int AS n, "
              + "       percentile_disc(0.50) WITHIN GROUP (ORDER BY "
              + "         EXTRACT(EPOCH FROM (complete_at - ready_at)) * 1000) AS p50, "
              + "       percentile_disc(0.95) WITHIN GROUP (ORDER BY "
              + "         EXTRACT(EPOCH FROM (complete_at - ready_at)) * 1000) AS p95, "
              + "       MAX(EXTRACT(EPOCH FROM (complete_at - ready_at)) * 1000)::bigint AS max_ms "
              + "FROM pairs "
              + "WHERE ready_at IS NOT NULL "
              + "GROUP BY workflow_id, step_id";
        return jdbc.query(sql, (rs, i) -> new StepMetric(
                (UUID) rs.getObject("workflow_id"),
                (UUID) rs.getObject("step_id"),
                rs.getInt("n"),
                rs.getObject("p50") == null ? null : ((Number) rs.getObject("p50")).longValue(),
                rs.getObject("p95") == null ? null : ((Number) rs.getObject("p95")).longValue(),
                rs.getObject("max_ms") == null ? null : rs.getLong("max_ms")),
                java.sql.Timestamp.from(since));
    }

    /** Device-level turnaround — same aggregation keyed by the
     *  actor_device_id of the COMPLETE transition. */
    public List<DeviceMetric> deviceMetrics(final Duration window) {
        final Instant since = Instant.now().minus(window);
        final String sql =
                "WITH pairs AS ("
              + "  SELECT c.workflow_id, c.step_id, c.actor_device_id, "
              + "    (SELECT MAX(r.transitioned_at) "
              + "       FROM der.capture_workflow_step_transition r "
              + "      WHERE r.run_id = c.run_id AND r.step_id = c.step_id "
              + "        AND r.to_state = 'READY' AND r.transitioned_at <= c.transitioned_at) AS ready_at, "
              + "    c.transitioned_at AS complete_at "
              + "  FROM der.capture_workflow_step_transition c "
              + "  WHERE c.to_state = 'COMPLETE' AND c.transitioned_at >= ? "
              + "    AND c.actor_device_id IS NOT NULL) "
              + "SELECT actor_device_id AS device_id, "
              + "       COUNT(*)::int AS n, "
              + "       percentile_disc(0.50) WITHIN GROUP (ORDER BY "
              + "         EXTRACT(EPOCH FROM (complete_at - ready_at)) * 1000) AS p50, "
              + "       percentile_disc(0.95) WITHIN GROUP (ORDER BY "
              + "         EXTRACT(EPOCH FROM (complete_at - ready_at)) * 1000) AS p95 "
              + "FROM pairs "
              + "WHERE ready_at IS NOT NULL "
              + "GROUP BY actor_device_id";
        final List<DeviceMetric> out = new ArrayList<>(jdbc.query(sql, (rs, i) -> new DeviceMetric(
                (UUID) rs.getObject("device_id"),
                rs.getInt("n"),
                rs.getObject("p50") == null ? null : ((Number) rs.getObject("p50")).longValue(),
                rs.getObject("p95") == null ? null : ((Number) rs.getObject("p95")).longValue()),
                java.sql.Timestamp.from(since)));
        return out;
    }

    public record StepMetric(UUID workflowId, UUID stepId,
                              int completedCount,
                              Long turnaroundP50Ms,
                              Long turnaroundP95Ms,
                              Long turnaroundMaxMs) { }

    public record DeviceMetric(UUID deviceId,
                                int completedCount,
                                Long turnaroundP50Ms,
                                Long turnaroundP95Ms) { }
}
