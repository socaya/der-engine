package ug.ac.mak.der.dhis2emulator;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC layer over {@code der.tracker_job} (V123). Stores one row per
 * async tracker-import call so DHIS2 clients can poll the ImportSummary
 * via {@code /api/tracker/jobs/{id}}.
 */
@Repository
public class TrackerJobRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public TrackerJobRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    public UUID insertRunning(final UUID userId) {
        final UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO der.tracker_job "
                        + "(job_id, status, user_id, created_at, summary_json) "
                        + "VALUES (?, 'RUNNING', ?, now(), '{}'::jsonb)",
                id, userId);
        return id;
    }

    public void markCompleted(final UUID jobId, final Map<String, Object> summary) {
        Objects.requireNonNull(jobId, "jobId");
        final String payload = serialise(summary);
        jdbc.update(
                "UPDATE der.tracker_job SET "
                        + "status = 'COMPLETED', completed_at = now(), "
                        + "summary_json = ?::jsonb "
                        + "WHERE job_id = ?",
                payload, jobId);
    }

    public void markFailed(final UUID jobId, final String error) {
        Objects.requireNonNull(jobId, "jobId");
        jdbc.update(
                "UPDATE der.tracker_job SET "
                        + "status = 'FAILED', completed_at = now(), "
                        + "error_message = ? "
                        + "WHERE job_id = ?",
                error == null ? "" : error, jobId);
    }

    /**
     * DER-APPS-DHIS2-001 Phase 5e retention — drop terminal
     * (COMPLETED / FAILED) {@code tracker_job} rows older than
     * {@code days} days. RUNNING rows are preserved so an admin who
     * reboots DER mid-import can still trace what happened. Caller
     * guards the retention window ≥ 1 day.
     */
    public int pruneOlderThan(final int days) {
        final int clamped = Math.max(1, days);
        return jdbc.update(
                "DELETE FROM der.tracker_job "
                        + "WHERE status IN ('COMPLETED', 'FAILED') "
                        + "  AND created_at < now() - (? || ' days')::interval",
                String.valueOf(clamped));
    }

    public Optional<Row> findById(final UUID jobId) {
        if (jobId == null) {
            return Optional.empty();
        }
        final var rows = jdbc.query(
                "SELECT job_id, status, user_id, created_at, completed_at, "
                        + "summary_json, error_message "
                        + "FROM der.tracker_job WHERE job_id = ?",
                (rs, n) -> new Row(
                        (UUID) rs.getObject(1),
                        rs.getString(2),
                        (UUID) rs.getObject(3),
                        timestamp(rs.getTimestamp(4)),
                        timestamp(rs.getTimestamp(5)),
                        parse(rs.getString(6)),
                        rs.getString(7)),
                jobId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    private static Instant timestamp(final Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    private String serialise(final Map<String, Object> summary) {
        try {
            return json.writeValueAsString(summary == null ? Map.of() : summary);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parse(final String s) {
        if (s == null || s.isBlank()) {
            return Map.of();
        }
        try {
            return json.readValue(s, Map.class);
        } catch (JsonProcessingException ex) {
            return Map.of();
        }
    }

    public record Row(UUID jobId,
                      String status,
                      UUID userId,
                      Instant createdAt,
                      Instant completedAt,
                      Map<String, Object> summary,
                      String errorMessage) { }
}
