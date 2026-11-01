package ug.ac.mak.der.workflow;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * §2.3.60 — prefetch coordination state (V068). Rows are inserted
 * by {@link WorkflowPrefetchCoordinator} when a step completes and
 * downstream steps become READY, then marked {@code acked_at} by
 * the client once it has warmed its cache.
 */
@Repository
public class CaptureWorkflowPrefetchRepository {

    private final JdbcTemplate jdbc;

    public CaptureWorkflowPrefetchRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Insert a prefetch notification for a (run, step, device) tuple.
     *  Idempotent — repeat notifications are swallowed via ON CONFLICT. */
    public void notify(final UUID runId, final UUID stepId, final UUID deviceId) {
        jdbc.update(
                "INSERT INTO der.capture_workflow_prefetch "
                        + "(run_id, step_id, device_id) VALUES (?, ?, ?) "
                        + "ON CONFLICT (run_id, step_id, device_id) "
                        + "DO UPDATE SET notified_at = EXCLUDED.notified_at, acked_at = NULL",
                runId, stepId, deviceId);
    }

    /** Mark a prefetch row acked by the device. Idempotent — repeated
     *  acks keep the first acked_at. */
    public int ack(final UUID stepId, final UUID deviceId) {
        return jdbc.update(
                "UPDATE der.capture_workflow_prefetch "
                        + "SET acked_at = NOW() "
                        + "WHERE step_id = ? AND device_id = ? AND acked_at IS NULL",
                stepId, deviceId);
    }

    /** Rows this device has been notified about but hasn't acked yet
     *  — client calls this on connect / resume to catch up on anything
     *  that fired while it was offline. */
    public List<PendingRow> pendingForDevice(final UUID deviceId) {
        return jdbc.query(
                "SELECT run_id, step_id, notified_at "
                        + "FROM der.capture_workflow_prefetch "
                        + "WHERE device_id = ? AND acked_at IS NULL "
                        + "ORDER BY notified_at ASC",
                (rs, i) -> new PendingRow(
                        (UUID) rs.getObject("run_id"),
                        (UUID) rs.getObject("step_id"),
                        rs.getTimestamp("notified_at").toInstant()),
                deviceId);
    }

    /** Count of prefetch rows older than the given cutoff that haven't
     *  been acked — fuel for the "device offline / failing to warm"
     *  admin signal on the monitoring screen. */
    public List<StaleDeviceRow> staleAcks(final Instant olderThan) {
        return jdbc.query(
                "SELECT device_id, COUNT(*) AS n, MIN(notified_at) AS oldest "
                        + "FROM der.capture_workflow_prefetch "
                        + "WHERE acked_at IS NULL AND notified_at < ? "
                        + "GROUP BY device_id",
                (rs, i) -> new StaleDeviceRow(
                        (UUID) rs.getObject("device_id"),
                        rs.getInt("n"),
                        rs.getTimestamp("oldest").toInstant()),
                Timestamp.from(olderThan));
    }

    public record PendingRow(UUID runId, UUID stepId, Instant notifiedAt) { }
    public record StaleDeviceRow(UUID deviceId, int pending, Instant oldest) { }
}
