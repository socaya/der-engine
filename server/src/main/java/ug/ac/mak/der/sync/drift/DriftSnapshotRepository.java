package ug.ac.mak.der.sync.drift;

import java.sql.ResultSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class DriftSnapshotRepository {

    private final JdbcTemplate jdbc;

    public DriftSnapshotRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public DriftSnapshot insert(final DriftSnapshot in) {
        final Long id = jdbc.queryForObject(
                "INSERT INTO der.drift_snapshot (snapshot_from, snapshot_to, fingerprint_from, "
                        + "fingerprint_to, deltas_json, triggered_by) "
                        + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?) RETURNING drift_id",
                Long.class, in.snapshotFrom(), in.snapshotTo(), in.fingerprintFrom(),
                in.fingerprintTo(), in.deltasJson(), in.triggeredBy());
        return new DriftSnapshot(id, in.capturedAt(), in.snapshotFrom(), in.snapshotTo(),
                in.fingerprintFrom(), in.fingerprintTo(), in.deltasJson(), in.triggeredBy());
    }

    public Optional<DriftSnapshot> findLatest() {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT drift_id, captured_at, snapshot_from, snapshot_to, fingerprint_from, "
                            + "fingerprint_to, deltas_json::text AS deltas_json, triggered_by "
                            + "FROM der.drift_snapshot ORDER BY captured_at DESC LIMIT 1",
                    rowMapper()));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<DriftSnapshot> findRecent(final int limit) {
        final int capped = Math.max(1, Math.min(100, limit));
        return jdbc.query(
                "SELECT drift_id, captured_at, snapshot_from, snapshot_to, fingerprint_from, "
                        + "fingerprint_to, deltas_json::text AS deltas_json, triggered_by "
                        + "FROM der.drift_snapshot ORDER BY captured_at DESC LIMIT ?",
                rowMapper(), capped);
    }

    private static RowMapper<DriftSnapshot> rowMapper() {
        return (ResultSet rs, int row) -> new DriftSnapshot(
                rs.getLong("drift_id"),
                rs.getTimestamp("captured_at").toInstant(),
                rs.getLong("snapshot_from"),
                rs.getLong("snapshot_to"),
                rs.getString("fingerprint_from"),
                rs.getString("fingerprint_to"),
                rs.getString("deltas_json"),
                rs.getString("triggered_by"));
    }
}
