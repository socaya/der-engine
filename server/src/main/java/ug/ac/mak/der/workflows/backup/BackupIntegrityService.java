package ug.ac.mak.der.workflows.backup;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * FR-14-06 — daily lightweight archive-integrity probe.
 *
 * <p>The weekly {@link BackupVerificationService} shadow-restores
 * into a throwaway database, which is expensive and depends on
 * {@code pg_restore} being installed with matching major version.
 * A pilot that loses silent bytes between weekly runs would not
 * discover it until Sunday 04:00 UTC. This service runs daily,
 * recomputes the SHA-256 of every recent SUCCESS backup archive,
 * compares to the anchor stored at backup time, and emits a
 * {@code BACKUP_INTEGRITY_CHECK} audit event per run.</p>
 *
 * <p>Outcomes recorded into {@code der.backup_verification}:
 * {@code INTEGRITY_SUCCESS} / {@code INTEGRITY_MISMATCH} /
 * {@code INTEGRITY_MISSING} / {@code INTEGRITY_SKIPPED}. Operators
 * read the per-source timeline through
 * {@code /admin/ops/backup/integrity/history}.</p>
 */
@Service
public class BackupIntegrityService {

    private static final Logger LOG =
            LoggerFactory.getLogger(BackupIntegrityService.class);

    private final JdbcTemplate jdbc;
    private final BackupRepository backups;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    @Value("${der.backup.integrity.enabled:true}")
    private boolean enabled;

    @Value("${der.backup.integrity.check-last-n:5}")
    private int checkLastN;

    public BackupIntegrityService(final JdbcTemplate jdbc,
                                    final BackupRepository backups,
                                    final SecurityAuditRepository audit,
                                    final ObjectMapper mapper,
                                    final Clock clock) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.backups = Objects.requireNonNull(backups, "backups");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /**
     * Daily at 05:00 UTC — offset from the 04:15 journal-retention
     * sweep so operator timelines stay legible.
     */
    @Scheduled(cron = "${der.backup.integrity.cron:0 0 5 * * *}")
    public void dailyCheck() {
        if (!enabled) {
            return;
        }
        try {
            runCheck("SCHEDULED");
        } catch (final RuntimeException ex) {
            LOG.warn("scheduled backup integrity check failed", ex);
        }
    }

    /** Operator-triggered check — audits with source=OPERATOR. */
    public Map<String, Object> runNow() {
        return runCheck("OPERATOR");
    }

    private Map<String, Object> runCheck(final String source) {
        final int cap = Math.max(1, Math.min(checkLastN, 50));
        final var recent = backups.findRecent(cap).stream()
                .filter(r -> r.status() == BackupRun.Status.SUCCESS)
                .toList();
        if (recent.isEmpty()) {
            return recordAndAudit(null, "INTEGRITY_SKIPPED", null,
                    "no SUCCESS backup available", source);
        }
        int successes = 0;
        int mismatches = 0;
        int missing = 0;
        Map<String, Object> lastResult = null;
        for (final BackupRun run : recent) {
            final String outcome = checkOne(run);
            final Map<String, Object> rec = recordAndAudit(run,
                    outcome, null, null, source);
            lastResult = rec;
            if ("INTEGRITY_SUCCESS".equals(outcome)) {
                successes++;
            } else if ("INTEGRITY_MISMATCH".equals(outcome)) {
                mismatches++;
            } else {
                missing++;
            }
        }
        if (mismatches > 0 || missing > 0) {
            LOG.warn("backup integrity: {} ok, {} MISMATCH, {} MISSING (source={})",
                    successes, mismatches, missing, source);
        } else {
            LOG.info("backup integrity: {} archives OK (source={})",
                    successes, source);
        }
        return lastResult;
    }

    private String checkOne(final BackupRun run) {
        final String path = run.archivePath();
        if (path == null || path.isBlank()) {
            return "INTEGRITY_MISSING";
        }
        final Path f = Paths.get(path);
        if (!Files.isReadable(f)) {
            return "INTEGRITY_MISSING";
        }
        final long size;
        try {
            size = Files.size(f);
        } catch (final IOException ex) {
            return "INTEGRITY_MISSING";
        }
        if (run.archiveBytes() != null && run.archiveBytes() != size) {
            return "INTEGRITY_MISMATCH";
        }
        final String anchor = run.archiveSha256();
        if (anchor == null || anchor.isBlank()) {
            // A pre-V126 backup — nothing to compare against. We
            // still verify the file is readable; call that SUCCESS
            // but don't claim a sha match.
            return "INTEGRITY_SUCCESS";
        }
        try {
            final String computed = BackupWorker.sha256Hex(f);
            return anchor.equalsIgnoreCase(computed)
                    ? "INTEGRITY_SUCCESS" : "INTEGRITY_MISMATCH";
        } catch (final IOException ex) {
            return "INTEGRITY_MISSING";
        }
    }

    private Map<String, Object> recordAndAudit(final BackupRun run,
                                                   final String outcome,
                                                   final Long durationMs,
                                                   final String reason,
                                                   final String source) {
        final UUID id = UUID.randomUUID();
        final Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("source", source);
        detail.put("outcome", outcome);
        if (run != null) {
            detail.put("backupRunId", String.valueOf(run.runId()));
            if (run.archivePath() != null) {
                detail.put("archivePath", run.archivePath());
            }
        }
        if (reason != null) {
            detail.put("reason", reason);
        }
        try {
            final String detailJson = mapper.writeValueAsString(detail);
            jdbc.update(
                    "INSERT INTO der.backup_verification "
                  + "(verification_id, backup_run_id, outcome, duration_ms, "
                  + " shadow_db_name, row_counts, reason) "
                  + "VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)",
                    id, run == null ? null : run.runId(), outcome,
                    durationMs, null, detailJson, reason);
        } catch (final Exception ex) {
            LOG.debug("integrity row insert failed: {}", ex.getMessage());
        }
        final AuditEvent.Outcome auditOutcome =
                "INTEGRITY_SUCCESS".equals(outcome)
                        ? AuditEvent.Outcome.SUCCESS
                        : AuditEvent.Outcome.ERROR;
        try {
            audit.append(new AuditEvent("BACKUP_INTEGRITY_CHECK",
                    auditOutcome, null, null, null, null, detail),
                    Instant.now(clock));
        } catch (final Exception ex) {
            LOG.debug("integrity audit append failed: {}", ex.getMessage());
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("verificationId", id.toString());
        out.put("outcome", outcome);
        out.put("backupRunId", run == null ? null : run.runId());
        out.put("reason", reason);
        return out;
    }

    public java.util.List<Map<String, Object>> history(final int limit) {
        return jdbc.query(
                "SELECT verification_id, backup_run_id, verified_at, outcome, "
              + "       duration_ms, row_counts::text AS row_counts, reason "
              + "  FROM der.backup_verification "
              + " WHERE outcome LIKE 'INTEGRITY\\_%' ESCAPE '\\' "
              + " ORDER BY verified_at DESC LIMIT ?",
                (rs, i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("verificationId",
                            rs.getObject("verification_id").toString());
                    m.put("backupRunId", rs.getObject("backup_run_id"));
                    m.put("verifiedAt",
                            rs.getTimestamp("verified_at").toInstant().toString());
                    m.put("outcome", rs.getString("outcome"));
                    m.put("durationMs", rs.getObject("duration_ms"));
                    m.put("detail", rs.getString("row_counts"));
                    m.put("reason", rs.getString("reason"));
                    return m;
                },
                Math.max(1, Math.min(limit, 100)));
    }
}
