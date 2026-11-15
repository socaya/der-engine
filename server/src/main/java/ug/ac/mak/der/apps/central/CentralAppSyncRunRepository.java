package ug.ac.mak.der.apps.central;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC layer over {@code der.app_central_sync_run} (V124). One row per
 * {@link CentralAppSyncService} execution.
 */
@Repository
public class CentralAppSyncRunRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public CentralAppSyncRunRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    public UUID insertStarted(final boolean dryRun, final UUID triggeredBy) {
        final UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO der.app_central_sync_run "
                        + "(run_id, started_at, outcome, dry_run, triggered_by, "
                        + " detail_json) "
                        + "VALUES (?, now(), 'RUNNING', ?, ?, '[]'::jsonb)",
                id, dryRun, triggeredBy);
        return id;
    }

    public void markComplete(final UUID runId,
                              final String outcome,
                              final String message,
                              final SyncCounters counters,
                              final List<CandidateDetail> details) {
        Objects.requireNonNull(runId, "runId");
        Objects.requireNonNull(outcome, "outcome");
        jdbc.update(
                "UPDATE der.app_central_sync_run SET "
                        + "completed_at = now(), outcome = ?, message = ?, "
                        + "discovered_count = ?, installed_count = ?, "
                        + "updated_count = ?, skipped_count = ?, "
                        + "failed_count = ?, detail_json = ?::jsonb "
                        + "WHERE run_id = ?",
                outcome, message,
                counters.discovered(), counters.installed(),
                counters.updated(), counters.skipped(), counters.failed(),
                serialise(details), runId);
    }

    public Optional<Row> latest() {
        final var rows = jdbc.query(
                "SELECT run_id, started_at, completed_at, outcome, message, "
                        + "dry_run, triggered_by, discovered_count, "
                        + "installed_count, updated_count, skipped_count, "
                        + "failed_count "
                        + "FROM der.app_central_sync_run "
                        + "ORDER BY started_at DESC LIMIT 1",
                (rs, n) -> new Row(
                        (UUID) rs.getObject(1),
                        toInstant(rs.getTimestamp(2)),
                        toInstant(rs.getTimestamp(3)),
                        rs.getString(4),
                        rs.getString(5),
                        rs.getBoolean(6),
                        (UUID) rs.getObject(7),
                        rs.getInt(8),
                        rs.getInt(9),
                        rs.getInt(10),
                        rs.getInt(11),
                        rs.getInt(12)));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public List<Row> recent(final int limit) {
        final int cap = Math.max(1, Math.min(limit, 100));
        return jdbc.query(
                "SELECT run_id, started_at, completed_at, outcome, message, "
                        + "dry_run, triggered_by, discovered_count, "
                        + "installed_count, updated_count, skipped_count, "
                        + "failed_count "
                        + "FROM der.app_central_sync_run "
                        + "ORDER BY started_at DESC LIMIT ?",
                (rs, n) -> new Row(
                        (UUID) rs.getObject(1),
                        toInstant(rs.getTimestamp(2)),
                        toInstant(rs.getTimestamp(3)),
                        rs.getString(4),
                        rs.getString(5),
                        rs.getBoolean(6),
                        (UUID) rs.getObject(7),
                        rs.getInt(8),
                        rs.getInt(9),
                        rs.getInt(10),
                        rs.getInt(11),
                        rs.getInt(12)),
                cap);
    }

    private static Instant toInstant(final Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    private String serialise(final List<CandidateDetail> details) {
        try {
            return json.writeValueAsString(details == null ? List.of() : details);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }

    public record SyncCounters(int discovered,
                               int installed,
                               int updated,
                               int skipped,
                               int failed) {
        public static SyncCounters zero() {
            return new SyncCounters(0, 0, 0, 0, 0);
        }
    }

    public record CandidateDetail(String key,
                                  String centralVersion,
                                  String localVersion,
                                  String action,
                                  String reason,
                                  String sha256) { }

    public record Row(UUID runId,
                      Instant startedAt,
                      Instant completedAt,
                      String outcome,
                      String message,
                      boolean dryRun,
                      UUID triggeredBy,
                      int discovered,
                      int installed,
                      int updated,
                      int skipped,
                      int failed) { }
}
