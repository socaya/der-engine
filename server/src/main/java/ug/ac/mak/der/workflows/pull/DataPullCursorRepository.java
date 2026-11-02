package ug.ac.mak.der.workflows.pull;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** ADR-0034 — read/write access to {@code der.data_pull_cursor}. */
@Repository
public class DataPullCursorRepository {

    private final JdbcTemplate jdbc;

    public DataPullCursorRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Optional<DataPullCursor> findByScope(final DataPullCursor.EntityType entityType,
                                                  final String orgUnitUid) {
        final List<DataPullCursor> rows = jdbc.query(
                "SELECT entity_type, org_unit_uid, last_pulled_at, last_cursor, "
                        + "consecutive_failures, last_error, created_at, updated_at "
                        + "FROM der.data_pull_cursor "
                        + "WHERE entity_type = ? AND org_unit_uid = ?",
                rowMapper(), entityType.name(), orgUnitUid);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public List<DataPullCursor> findAll() {
        return jdbc.query(
                "SELECT entity_type, org_unit_uid, last_pulled_at, last_cursor, "
                        + "consecutive_failures, last_error, created_at, updated_at "
                        + "FROM der.data_pull_cursor "
                        + "ORDER BY entity_type, org_unit_uid",
                rowMapper());
    }

    /**
     * Upsert the watermark + reset failure counters. Called by the
     * puller after a successful pull completes.
     */
    public void markSuccess(final DataPullCursor.EntityType entityType,
                              final String orgUnitUid,
                              final Instant watermark,
                              final String cursor) {
        jdbc.update(
                "INSERT INTO der.data_pull_cursor "
                        + "(entity_type, org_unit_uid, last_pulled_at, last_cursor, "
                        + " consecutive_failures, last_error, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, 0, NULL, now(), now()) "
                        + "ON CONFLICT (entity_type, org_unit_uid) DO UPDATE SET "
                        + "   last_pulled_at = EXCLUDED.last_pulled_at, "
                        + "   last_cursor = EXCLUDED.last_cursor, "
                        + "   consecutive_failures = 0, "
                        + "   last_error = NULL, "
                        + "   updated_at = now()",
                entityType.name(), orgUnitUid,
                watermark == null ? null : Timestamp.from(watermark),
                cursor);
    }

    /** Record a failed pull without advancing the watermark. */
    public void markFailure(final DataPullCursor.EntityType entityType,
                              final String orgUnitUid,
                              final String error) {
        jdbc.update(
                "INSERT INTO der.data_pull_cursor "
                        + "(entity_type, org_unit_uid, consecutive_failures, "
                        + " last_error, created_at, updated_at) "
                        + "VALUES (?, ?, 1, ?, now(), now()) "
                        + "ON CONFLICT (entity_type, org_unit_uid) DO UPDATE SET "
                        + "   consecutive_failures = der.data_pull_cursor.consecutive_failures + 1, "
                        + "   last_error = EXCLUDED.last_error, "
                        + "   updated_at = now()",
                entityType.name(), orgUnitUid, error);
    }

    private static RowMapper<DataPullCursor> rowMapper() {
        return (ResultSet rs, int n) -> new DataPullCursor(
                DataPullCursor.EntityType.valueOf(rs.getString("entity_type")),
                rs.getString("org_unit_uid"),
                rs.getTimestamp("last_pulled_at") == null ? null
                        : rs.getTimestamp("last_pulled_at").toInstant(),
                rs.getString("last_cursor"),
                rs.getInt("consecutive_failures"),
                rs.getString("last_error"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }
}
