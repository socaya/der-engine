package ug.ac.mak.der.workflows.backup;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** §5 PITR — WAL archive tracking.
 *
 *  <p>Postgres runs {@code archive_command = 'cp "%p" /var/lib/der/wal/%f'}
 *  (configured by the operator in postgresql.conf). This service is
 *  the audit side — it watches the archive directory and inserts a
 *  row per new segment, computes the SHA-256, and optionally
 *  uploads to an off-box bucket.</p>
 */
@Service
public class WalArchiveService {

    private static final Logger LOG = LoggerFactory.getLogger(WalArchiveService.class);

    private final JdbcTemplate jdbc;

    @Value("${der.backup.wal.dir:/var/lib/der/wal}")
    private String walDir;

    @Value("${der.backup.wal.enabled:true}")
    private boolean enabled;

    public WalArchiveService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Scan the WAL archive directory every 30 s. Any new segment
     *  gets a row + sha. We only record metadata here; actual archive
     *  storage is handled by Postgres {@code archive_command}. */
    @Scheduled(fixedDelayString = "${der.backup.wal.scanInterval:30000}",
               initialDelayString = "${der.backup.wal.initialDelay:30000}")
    public void scanArchive() {
        if (!enabled) {
            return;
        }
        final Path dir = Paths.get(walDir);
        if (!Files.isDirectory(dir)) {
            return;
        }
        try (var stream = Files.list(dir)) {
            stream.forEach(f -> maybeRecord(f));
        } catch (final Exception ex) {
            LOG.debug("WAL scan failed", ex);
        }
    }

    private void maybeRecord(final Path f) {
        final String name = f.getFileName().toString();
        final Integer seen = jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM der.wal_segment WHERE filename = ?",
            Integer.class, name);
        if (seen != null && seen > 0) {
            return;
        }
        try {
            final long size = Files.size(f);
            final String sha = sha256Hex(Files.readAllBytes(f));
            jdbc.update(
                "INSERT INTO der.wal_segment (filename, archive_path, size_bytes, sha256) "
              + "VALUES (?, ?, ?, ?) ON CONFLICT (filename) DO NOTHING",
                name, f.toString(), size, sha);
        } catch (final Exception ex) {
            LOG.warn("WAL segment record failed for {}", name, ex);
        }
    }

    public List<Map<String, Object>> listSegments(final int limit) {
        return jdbc.query(
            "SELECT segment_id, filename, archive_path, size_bytes, "
          + "       archived_at, uploaded_at, upload_destination, sha256 "
          + "  FROM der.wal_segment ORDER BY archived_at DESC LIMIT ?",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("segmentId", rs.getLong("segment_id"));
                m.put("filename",  rs.getString("filename"));
                m.put("archivePath", rs.getString("archive_path"));
                m.put("sizeBytes", rs.getLong("size_bytes"));
                m.put("archivedAt", rs.getTimestamp("archived_at").toInstant().toString());
                final Timestamp up = rs.getTimestamp("uploaded_at");
                m.put("uploadedAt", up == null ? null : up.toInstant().toString());
                m.put("uploadDestination", rs.getString("upload_destination"));
                m.put("sha256", rs.getString("sha256"));
                return m;
            },
            Math.max(1, Math.min(limit, 500)));
    }

    public Map<String, Object> summary() {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("walEnabled", enabled);
        m.put("walDirectory", walDir);
        m.put("walDirExists", Files.isDirectory(Paths.get(walDir)));
        try {
            m.put("segmentCount", jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM der.wal_segment", Integer.class));
            final Timestamp earliest = jdbc.queryForObject(
                "SELECT MIN(archived_at) FROM der.wal_segment", Timestamp.class);
            m.put("earliestArchive", earliest == null ? null : earliest.toInstant().toString());
            final Timestamp latest = jdbc.queryForObject(
                "SELECT MAX(archived_at) FROM der.wal_segment", Timestamp.class);
            m.put("latestArchive", latest == null ? null : latest.toInstant().toString());
            final Long bytes = jdbc.queryForObject(
                "SELECT COALESCE(SUM(size_bytes), 0) FROM der.wal_segment", Long.class);
            m.put("totalBytes", bytes);
        } catch (final Exception ignored) {
            // table empty — stats stay 0
        }
        return m;
    }

    public Map<String, Object> postgresqlSnippet() {
        return Map.of(
            "note", "Paste into postgresql.conf and restart Postgres",
            "lines", List.of(
                "wal_level = replica",
                "archive_mode = on",
                "archive_command = 'test ! -f " + walDir + "/%f && cp %p " + walDir + "/%f'",
                "archive_timeout = 60",
                "max_wal_senders = 3",
                "wal_keep_size = 1024"));
    }

    private static String sha256Hex(final byte[] bytes) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (final Exception ex) {
            return "";
        }
    }

    /** Return the WAL segment range needed to roll a base backup
     *  forward to the given recovery_target_time. */
    public Map<String, Object> pitrPlan(final Instant target) {
        final List<Map<String, Object>> needed = jdbc.query(
            "SELECT filename, archived_at, archive_path FROM der.wal_segment "
          + " WHERE archived_at <= ? ORDER BY archived_at ASC",
            (rs, i) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("filename", rs.getString("filename"));
                m.put("archivedAt", rs.getTimestamp("archived_at").toInstant().toString());
                m.put("archivePath", rs.getString("archive_path"));
                return m;
            },
            Timestamp.from(target));
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("recoveryTarget", target.toString());
        m.put("segmentCount", needed.size());
        m.put("segments", needed);
        m.put("recoveryConfSnippet", List.of(
            "restore_command = 'cp " + walDir + "/%f %p'",
            "recovery_target_time = '" + target.toString() + "'",
            "recovery_target_action = 'promote'"));
        return m;
    }
}
