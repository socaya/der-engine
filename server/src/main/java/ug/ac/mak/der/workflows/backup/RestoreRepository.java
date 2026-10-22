package ug.ac.mak.der.workflows.backup;

import java.sql.ResultSet;
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

@Repository
public class RestoreRepository {

    private final JdbcTemplate jdbc;

    public RestoreRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public RestoreRun insert(final RestoreRun in) {
        final Long id = jdbc.queryForObject(
                "INSERT INTO der.restore_run (requested_at, requested_by, source, status, "
                        + "message, kind) VALUES (?, ?, ?, ?, ?, ?) RETURNING run_id",
                Long.class,
                Timestamp.from(in.requestedAt()), in.requestedBy(), in.source(),
                in.status().name(), in.message(),
                in.kind() == null ? null : in.kind().name());
        return new RestoreRun(id, in.requestedAt(), in.requestedBy(), in.source(),
                in.status(), in.message(), in.startedAt(), in.finishedAt(),
                in.archivePath(), in.kind());
    }

    public Optional<RestoreRun> findById(final long id) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT run_id, requested_at, requested_by, source, status, message, "
                            + "started_at, finished_at, archive_path, kind "
                            + "FROM der.restore_run WHERE run_id = ?",
                    rowMapper(), id));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<RestoreRun> findRecent(final int limit) {
        return jdbc.query(
                "SELECT run_id, requested_at, requested_by, source, status, message, "
                        + "started_at, finished_at, archive_path, kind "
                        + "FROM der.restore_run ORDER BY requested_at DESC LIMIT ?",
                rowMapper(), Math.max(1, Math.min(200, limit)));
    }

    public List<RestoreRun> findByStatus(final RestoreRun.Status status, final int limit) {
        return jdbc.query(
                "SELECT run_id, requested_at, requested_by, source, status, message, "
                        + "started_at, finished_at, archive_path, kind "
                        + "FROM der.restore_run WHERE status = ? "
                        + "ORDER BY requested_at ASC LIMIT ?",
                rowMapper(), status.name(), Math.max(1, Math.min(200, limit)));
    }

    public int markStarted(final long id, final String archivePath) {
        return jdbc.update("UPDATE der.restore_run SET status = 'QUEUED', "
                        + "started_at = now(), archive_path = ? WHERE run_id = ?",
                archivePath, id);
    }

    public int markSuccess(final long id) {
        return jdbc.update("UPDATE der.restore_run SET status = 'SUCCESS', finished_at = now(), "
                        + "message = NULL WHERE run_id = ?", id);
    }

    public int markFailed(final long id, final String message) {
        return jdbc.update("UPDATE der.restore_run SET status = 'FAILED', finished_at = now(), "
                        + "message = ? WHERE run_id = ?", message, id);
    }

    private static RowMapper<RestoreRun> rowMapper() {
        return (ResultSet rs, int row) -> new RestoreRun(
                rs.getLong("run_id"),
                rs.getTimestamp("requested_at").toInstant(),
                (UUID) rs.getObject("requested_by"),
                rs.getString("source"),
                RestoreRun.Status.valueOf(rs.getString("status")),
                rs.getString("message"),
                optInstant(rs.getTimestamp("started_at")),
                optInstant(rs.getTimestamp("finished_at")),
                rs.getString("archive_path"),
                rs.getString("kind") == null ? null : RestoreRun.Kind.valueOf(rs.getString("kind")));
    }

    private static Instant optInstant(final Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
}
