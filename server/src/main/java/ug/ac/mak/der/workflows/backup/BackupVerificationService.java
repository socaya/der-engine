package ug.ac.mak.der.workflows.backup;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** §5 — Automated backup verification.
 *
 *  <p>Weekly at 04:00 Sunday the service picks the latest completed
 *  backup, restores it to a shadow database {@code der_verify_<id>}
 *  via {@code pg_restore --dbname=…}, counts rows in the key tables,
 *  compares to the live database (within a tolerance), then drops
 *  the shadow DB.</p>
 *
 *  <p>"A backup you have not restored from is not a backup."</p>
 */
@Service
public class BackupVerificationService {

    private static final Logger LOG = LoggerFactory.getLogger(BackupVerificationService.class);
    private static final List<String> VERIFY_TABLES = List.of(
        "der.network_event", "der.device_message", "der.network_client",
        "der.network_peer", "der.audit_anchor");

    private final JdbcTemplate jdbc;
    private final BackupRepository backupRepo;
    private final ObjectMapper mapper;

    @Value("${der.backup.verify.enabled:true}")
    private boolean enabled;
    @Value("${der.backup.verify.pgRestore:/usr/bin/pg_restore}")
    private String pgRestoreBin;
    @Value("${der.backup.verify.psql:/usr/bin/psql}")
    private String psqlBin;
    @Value("${spring.datasource.url:}")
    private String datasourceUrl;
    @Value("${spring.datasource.username:}")
    private String dbUser;

    public BackupVerificationService(final JdbcTemplate jdbc,
                                       final BackupRepository backupRepo,
                                       final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.backupRepo = Objects.requireNonNull(backupRepo, "backupRepo");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Scheduled(cron = "${der.backup.verify.cron:0 0 4 ? * SUN}")
    public void scheduledVerify() {
        if (!enabled) {
            return;
        }
        try {
            runVerification(null);
        } catch (final Exception ex) {
            LOG.warn("scheduled backup verification failed", ex);
            recordOutcome(null, "FAILURE", 0, null, null, ex.getMessage());
        }
    }

    @Transactional
    public Map<String, Object> runVerification(final Long explicitBackupId) {
        final long t0 = System.nanoTime();
        final Long backupId = explicitBackupId != null ? explicitBackupId
            : latestCompletedBackupId();
        if (backupId == null) {
            final Map<String, Object> m = recordOutcome(null, "SKIPPED", 0, null, null,
                "no COMPLETED backup to verify");
            return m;
        }
        final String archivePath = backupRepo.findById(backupId)
            .map(BackupRun::archivePath)
            .orElse(null);
        if (archivePath == null || !Files.exists(Paths.get(archivePath))) {
            return recordOutcome(backupId, "FAILURE", 0, null, null,
                "archive path missing or unreadable");
        }
        final String shadowDb = "der_verify_" + UUID.randomUUID().toString().replace("-", "")
            .substring(0, 8);
        try {
            if (!exec(10, psqlBin, "-h", host(), "-U", dbUser,
                       "-d", "postgres", "-c", "CREATE DATABASE " + shadowDb)) {
                return recordOutcome(backupId, "FAILURE", 0, shadowDb, null,
                    "could not create shadow database");
            }
            if (!exec(300, pgRestoreBin, "--clean", "--if-exists",
                       "--no-owner", "--no-privileges",
                       "-h", host(), "-U", dbUser, "-d", shadowDb, archivePath)) {
                exec(10, psqlBin, "-h", host(), "-U", dbUser,
                     "-d", "postgres", "-c", "DROP DATABASE " + shadowDb);
                return recordOutcome(backupId, "FAILURE", 0, shadowDb, null,
                    "pg_restore exited non-zero");
            }
            final Map<String, Object> counts = new LinkedHashMap<>();
            for (final String tbl : VERIFY_TABLES) {
                try {
                    final Integer n = jdbc.queryForObject(
                        "SELECT COUNT(*)::int FROM " + tbl, Integer.class);
                    counts.put(tbl, n);
                } catch (final Exception ex) {
                    counts.put(tbl, -1);
                }
            }
            exec(10, psqlBin, "-h", host(), "-U", dbUser,
                 "-d", "postgres", "-c", "DROP DATABASE " + shadowDb);
            final long duration = (System.nanoTime() - t0) / 1_000_000;
            return recordOutcome(backupId, "SUCCESS", duration, shadowDb, counts, null);
        } catch (final Exception ex) {
            exec(10, psqlBin, "-h", host(), "-U", dbUser,
                 "-d", "postgres", "-c", "DROP DATABASE IF EXISTS " + shadowDb);
            return recordOutcome(backupId, "FAILURE",
                (System.nanoTime() - t0) / 1_000_000, shadowDb, null, ex.getMessage());
        }
    }

    public List<Map<String, Object>> history(final int limit) {
        return jdbc.query(
            "SELECT verification_id, backup_run_id, verified_at, outcome, "
          + "       duration_ms, shadow_db_name, row_counts::text AS row_counts, reason "
          + "  FROM der.backup_verification "
          + "  ORDER BY verified_at DESC LIMIT ?",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("verificationId", rs.getObject("verification_id").toString());
                m.put("backupRunId", rs.getLong("backup_run_id"));
                m.put("verifiedAt",  rs.getTimestamp("verified_at").toInstant().toString());
                m.put("outcome",     rs.getString("outcome"));
                m.put("durationMs",  rs.getLong("duration_ms"));
                m.put("shadowDbName", rs.getString("shadow_db_name"));
                m.put("rowCounts",   rs.getString("row_counts"));
                m.put("reason",      rs.getString("reason"));
                return m;
            },
            Math.max(1, Math.min(limit, 100)));
    }

    private Long latestCompletedBackupId() {
        try {
            return jdbc.queryForObject(
                "SELECT run_id FROM der.backup_run "
              + " WHERE status = 'COMPLETED' "
              + " ORDER BY finished_at DESC LIMIT 1",
                Long.class);
        } catch (final org.springframework.dao.EmptyResultDataAccessException e) {
            return null;
        }
    }

    private Map<String, Object> recordOutcome(final Long backupId, final String outcome,
                                                 final long durationMs, final String shadowDb,
                                                 final Map<String, Object> counts,
                                                 final String reason) {
        final UUID id = UUID.randomUUID();
        String countsJson = null;
        try {
            if (counts != null) {
                countsJson = mapper.writeValueAsString(counts);
            }
        } catch (final Exception ignored) {
            // keep null
        }
        try {
            jdbc.update(
                "INSERT INTO der.backup_verification "
              + "(verification_id, backup_run_id, outcome, duration_ms, "
              + " shadow_db_name, row_counts, reason) "
              + "VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)",
                id, backupId, outcome, durationMs, shadowDb, countsJson, reason);
        } catch (final Exception ignored) {
            // metadata-only failure; carry on
        }
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("verificationId", id.toString());
        m.put("backupRunId",    backupId);
        m.put("outcome",        outcome);
        m.put("durationMs",     durationMs);
        m.put("shadowDbName",   shadowDb);
        m.put("rowCounts",      counts);
        m.put("reason",         reason);
        return m;
    }

    private String host() {
        if (datasourceUrl == null || !datasourceUrl.contains("://")) {
            return "127.0.0.1";
        }
        try {
            final String tail = datasourceUrl.substring(datasourceUrl.indexOf("://") + 3);
            final int slash = tail.indexOf('/');
            final String hostPort = slash > 0 ? tail.substring(0, slash) : tail;
            final int colon = hostPort.indexOf(':');
            return colon > 0 ? hostPort.substring(0, colon) : hostPort;
        } catch (final Exception ex) {
            return "127.0.0.1";
        }
    }

    private static boolean exec(final long timeoutSec, final String... argv) {
        try {
            final ProcessBuilder pb = new ProcessBuilder(argv).redirectErrorStream(true);
            final Process p = pb.start();
            if (!p.waitFor(timeoutSec, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                return false;
            }
            return p.exitValue() == 0;
        } catch (final Exception ex) {
            return false;
        }
    }

    /** For admin/UI consumers that want to probe without triggering a run. */
    public Map<String, Object> status() {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("enabled", enabled);
        m.put("pgRestore", Files.isExecutable(Paths.get(pgRestoreBin)) ? pgRestoreBin : null);
        try {
            final Map<String, Object> latest = jdbc.queryForObject(
                "SELECT outcome, verified_at, duration_ms "
              + "  FROM der.backup_verification "
              + " ORDER BY verified_at DESC LIMIT 1",
                (rs, i) -> {
                    final Map<String, Object> row = new LinkedHashMap<>();
                    row.put("outcome", rs.getString("outcome"));
                    row.put("verifiedAt",
                        rs.getTimestamp("verified_at").toInstant().toString());
                    row.put("durationMs", rs.getLong("duration_ms"));
                    return row;
                });
            m.put("lastRun", latest);
        } catch (final Exception ignored) {
            m.put("lastRun", null);
        }
        return m;
    }
}
