package ug.ac.mak.der.analytics.dlq;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import ug.ac.mak.der.analytics.engine.AnalyticsSourceEvent;

/** JDBC layer for {@code der.analytics_live_dlq} (V116). */
@Repository
public class AnalyticsLiveDlqRepository {

    private final JdbcTemplate jdbc;

    public AnalyticsLiveDlqRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Enqueue or refresh a DLQ entry. Upsert-by-(source_type,
     *  source_key, source_version) so a duplicate-event-after-crash
     *  doesn't inflate the queue — attempt count is bumped by the
     *  retry worker, not by re-arrival on the hot path. */
    public UUID enqueue(final AnalyticsLiveDlqEntry entry) {
        Objects.requireNonNull(entry, "entry");
        return jdbc.queryForObject(
                "INSERT INTO der.analytics_live_dlq ("
              + "  dlq_id, source_type, source_key, source_version, "
              + "  occurred_on, org_unit_uid, status, error_summary, "
              + "  attempt_count, next_retry_at, gave_up, "
              + "  last_attempted_at) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
              + "ON CONFLICT (source_type, source_key, source_version) "
              + "DO UPDATE SET "
              + "  error_summary = EXCLUDED.error_summary, "
              + "  occurred_on = EXCLUDED.occurred_on, "
              + "  org_unit_uid = EXCLUDED.org_unit_uid, "
              + "  status = EXCLUDED.status, "
              + "  last_attempted_at = EXCLUDED.last_attempted_at, "
              + "  attempt_count = der.analytics_live_dlq.attempt_count "
              + "RETURNING dlq_id",
                UUID.class,
                entry.dlqId(), entry.sourceType().name(), entry.sourceKey(),
                entry.sourceVersion(),
                java.sql.Date.valueOf(entry.occurredOn()),
                entry.orgUnitUid(), entry.status(), entry.errorSummary(),
                entry.attemptCount(), Timestamp.from(entry.nextRetryAt()),
                entry.gaveUp(), Timestamp.from(entry.lastAttemptedAt()));
    }

    /** Return every entry whose {@code next_retry_at} is in the
     *  past and whose {@code gave_up} flag is still false. The
     *  retry worker consumes these one-at-a-time. */
    public List<AnalyticsLiveDlqEntry> dueForRetry(final Instant now,
                                                     final int limit) {
        return jdbc.query(
                "SELECT dlq_id, source_type, source_key, source_version, "
              + "       occurred_on, org_unit_uid, status, error_summary, "
              + "       attempt_count, next_retry_at, gave_up, "
              + "       created_at, last_attempted_at "
              + "  FROM der.analytics_live_dlq "
              + " WHERE gave_up = FALSE AND next_retry_at <= ? "
              + " ORDER BY next_retry_at ASC "
              + " LIMIT ?",
                MAPPER, Timestamp.from(now),
                Math.max(1, Math.min(500, limit)));
    }

    /** Record a retry outcome. On success → row removed. On
     *  failure → attempt_count bumped, next_retry_at scheduled,
     *  gave_up flipped when the ceiling is hit. */
    public int markRetried(final UUID dlqId,
                             final int newAttemptCount,
                             final Instant nextRetryAt,
                             final boolean gaveUp,
                             final String errorSummary) {
        return jdbc.update(
                "UPDATE der.analytics_live_dlq "
              + "   SET attempt_count = ?, "
              + "       next_retry_at = ?, "
              + "       gave_up = ?, "
              + "       error_summary = ?, "
              + "       last_attempted_at = now() "
              + " WHERE dlq_id = ?",
                newAttemptCount, Timestamp.from(nextRetryAt),
                gaveUp, errorSummary, dlqId);
    }

    public int remove(final UUID dlqId) {
        return jdbc.update(
                "DELETE FROM der.analytics_live_dlq WHERE dlq_id = ?",
                dlqId);
    }

    public Optional<AnalyticsLiveDlqEntry> findById(final UUID dlqId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT dlq_id, source_type, source_key, source_version, "
                  + "       occurred_on, org_unit_uid, status, error_summary, "
                  + "       attempt_count, next_retry_at, gave_up, "
                  + "       created_at, last_attempted_at "
                  + "  FROM der.analytics_live_dlq WHERE dlq_id = ?",
                    MAPPER, dlqId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<AnalyticsLiveDlqEntry> list(final boolean gaveUpOnly,
                                              final int limit) {
        return jdbc.query(
                "SELECT dlq_id, source_type, source_key, source_version, "
              + "       occurred_on, org_unit_uid, status, error_summary, "
              + "       attempt_count, next_retry_at, gave_up, "
              + "       created_at, last_attempted_at "
              + "  FROM der.analytics_live_dlq "
              + " WHERE gave_up = ? OR ? = FALSE "
              + " ORDER BY last_attempted_at DESC LIMIT ?",
                MAPPER, gaveUpOnly, gaveUpOnly,
                Math.max(1, Math.min(1000, limit)));
    }

    public long countAll() {
        final Long v = jdbc.queryForObject(
                "SELECT COUNT(*)::bigint FROM der.analytics_live_dlq",
                Long.class);
        return v == null ? 0L : v;
    }

    public long countGaveUp() {
        final Long v = jdbc.queryForObject(
                "SELECT COUNT(*)::bigint FROM der.analytics_live_dlq "
              + " WHERE gave_up = TRUE", Long.class);
        return v == null ? 0L : v;
    }

    private static final RowMapper<AnalyticsLiveDlqEntry> MAPPER =
        (rs, i) -> new AnalyticsLiveDlqEntry(
                (UUID) rs.getObject("dlq_id"),
                AnalyticsSourceEvent.SourceType.valueOf(
                        rs.getString("source_type")),
                rs.getString("source_key"),
                rs.getLong("source_version"),
                rs.getDate("occurred_on") == null ? null
                        : rs.getDate("occurred_on").toLocalDate(),
                rs.getString("org_unit_uid"),
                rs.getString("status"),
                rs.getString("error_summary"),
                rs.getInt("attempt_count"),
                rs.getTimestamp("next_retry_at") == null ? Instant.EPOCH
                        : rs.getTimestamp("next_retry_at").toInstant(),
                rs.getBoolean("gave_up"),
                rs.getTimestamp("created_at") == null ? null
                        : rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("last_attempted_at") == null ? null
                        : rs.getTimestamp("last_attempted_at").toInstant());
}
