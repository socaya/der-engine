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
public class BackupRepository {

    private final JdbcTemplate jdbc;

    public BackupRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public BackupRun insert(final BackupRun in) {
        final Long id = jdbc.queryForObject(
                "INSERT INTO der.backup_run (requested_at, requested_by, kind, status, message) "
                        + "VALUES (?, ?, ?, ?, ?) RETURNING run_id",
                Long.class,
                Timestamp.from(in.requestedAt()), in.requestedBy(),
                in.kind().name(), in.status().name(), in.message());
        return new BackupRun(id, in.requestedAt(), in.requestedBy(), in.kind(),
                in.status(), in.message(), in.archivePath(), in.archiveBytes(),
                in.remoteKey(), in.startedAt(), in.finishedAt(), in.pgDumpVersion());
    }

    public Optional<BackupRun> findById(final long id) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT run_id, requested_at, requested_by, kind, status, message, "
                            + "archive_path, archive_bytes, remote_key, started_at, finished_at, "
                            + "pg_dump_version FROM der.backup_run WHERE run_id = ?",
                    rowMapper(), id));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<BackupRun> findRecent(final int limit) {
        final int capped = Math.max(1, Math.min(200, limit));
        return jdbc.query(
                "SELECT run_id, requested_at, requested_by, kind, status, message, "
                        + "archive_path, archive_bytes, remote_key, started_at, finished_at, "
                        + "pg_dump_version FROM der.backup_run "
                        + "ORDER BY requested_at DESC LIMIT ?",
                rowMapper(), capped);
    }

    public List<BackupRun> findByStatus(final BackupRun.Status status, final int limit) {
        return jdbc.query(
                "SELECT run_id, requested_at, requested_by, kind, status, message, "
                        + "archive_path, archive_bytes, remote_key, started_at, finished_at, "
                        + "pg_dump_version FROM der.backup_run WHERE status = ? "
                        + "ORDER BY requested_at ASC LIMIT ?",
                rowMapper(), status.name(), Math.max(1, Math.min(200, limit)));
    }

    public int markStarted(final long id, final String pgDumpVersion) {
        return jdbc.update("UPDATE der.backup_run SET status = 'QUEUED', "
                        + "started_at = now(), pg_dump_version = ? WHERE run_id = ?",
                pgDumpVersion, id);
    }

    public int markSuccess(final long id, final String path, final long bytes, final String key) {
        return jdbc.update("UPDATE der.backup_run SET status = 'SUCCESS', finished_at = now(), "
                        + "archive_path = ?, archive_bytes = ?, remote_key = ?, "
                        + "message = NULL WHERE run_id = ?",
                path, bytes, key, id);
    }

    public int markFailed(final long id, final String message) {
        return jdbc.update("UPDATE der.backup_run SET status = 'FAILED', finished_at = now(), "
                        + "message = ? WHERE run_id = ?", message, id);
    }

    private static RowMapper<BackupRun> rowMapper() {
        return (ResultSet rs, int row) -> new BackupRun(
                rs.getLong("run_id"),
                rs.getTimestamp("requested_at").toInstant(),
                (UUID) rs.getObject("requested_by"),
                BackupRun.Kind.valueOf(rs.getString("kind")),
                BackupRun.Status.valueOf(rs.getString("status")),
                rs.getString("message"),
                rs.getString("archive_path"),
                (Long) rs.getObject("archive_bytes"),
                rs.getString("remote_key"),
                optInstant(rs.getTimestamp("started_at")),
                optInstant(rs.getTimestamp("finished_at")),
                rs.getString("pg_dump_version"));
    }

    private static Instant optInstant(final Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
}
