package ug.ac.mak.der.workflow;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * ADR-0025 persistence for per-step payload buffers. Upsert replaces
 * the earlier contribution for the same {@code (run_id, step_id)} —
 * matches DHIS2's re-POST semantics on dataValueSets.
 */
@Repository
@ConditionalOnBean(JdbcTemplate.class)
public class CaptureWorkflowContributionRepository {

    private final JdbcTemplate jdbc;

    public CaptureWorkflowContributionRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public CaptureWorkflowContribution upsert(final CaptureWorkflowContribution c) {
        Objects.requireNonNull(c, "c");
        jdbc.update(
                "INSERT INTO der.capture_workflow_step_contribution "
                        + "(contribution_id, run_id, step_id, payload, submitted_by, "
                        + " submitted_device_id, submitted_at) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), ?, ?, ?) "
                        + "ON CONFLICT (run_id, step_id) DO UPDATE SET "
                        + "  payload = EXCLUDED.payload, "
                        + "  submitted_by = EXCLUDED.submitted_by, "
                        + "  submitted_device_id = EXCLUDED.submitted_device_id, "
                        + "  submitted_at = EXCLUDED.submitted_at",
                c.contributionId(), c.runId(), c.stepId(), c.payload(),
                c.submittedBy(), c.submittedDeviceId(),
                Timestamp.from(c.submittedAt()));
        return c;
    }

    public List<CaptureWorkflowContribution> findByRun(final UUID runId) {
        if (runId == null) {
            return List.of();
        }
        return jdbc.query(
                "SELECT contribution_id, run_id, step_id, payload::text AS payload, "
                        + "submitted_by, submitted_device_id, submitted_at "
                        + "FROM der.capture_workflow_step_contribution "
                        + "WHERE run_id = ? ORDER BY submitted_at ASC",
                mapper(), runId);
    }

    private RowMapper<CaptureWorkflowContribution> mapper() {
        return (ResultSet rs, int row) -> new CaptureWorkflowContribution(
                (UUID) rs.getObject("contribution_id"),
                (UUID) rs.getObject("run_id"),
                (UUID) rs.getObject("step_id"),
                rs.getString("payload"),
                (UUID) rs.getObject("submitted_by"),
                (UUID) rs.getObject("submitted_device_id"),
                rs.getTimestamp("submitted_at").toInstant());
    }
}
