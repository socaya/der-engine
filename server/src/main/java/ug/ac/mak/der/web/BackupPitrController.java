package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.workflows.backup.BackupVerificationService;
import ug.ac.mak.der.workflows.backup.WalArchiveService;

/** §5 — PITR + backup verification REST surface. */
@RestController
@RequestMapping(path = "/edge-api/v1/backup/pitr",
                 produces = MediaType.APPLICATION_JSON_VALUE)
public class BackupPitrController {

    private final WalArchiveService wal;
    private final BackupVerificationService verify;

    public BackupPitrController(final WalArchiveService wal,
                                  final BackupVerificationService verify) {
        this.wal = Objects.requireNonNull(wal, "wal");
        this.verify = Objects.requireNonNull(verify, "verify");
    }

    /* ─── WAL / PITR ─────────────────────────────────────────── */

    @GetMapping("/wal")
    public ResponseEntity<Map<String, Object>> walSummary() {
        return ResponseEntity.ok(wal.summary());
    }

    @GetMapping("/wal/segments")
    public ResponseEntity<Map<String, Object>> walSegments(
            @RequestParam(value = "limit", defaultValue = "100") final int limit) {
        return ResponseEntity.ok(Map.of("segments", wal.listSegments(limit)));
    }

    @GetMapping("/wal/postgresql-conf")
    public ResponseEntity<Map<String, Object>> walConfigSnippet() {
        return ResponseEntity.ok(wal.postgresqlSnippet());
    }

    @PostMapping(path = "/plan", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> plan(@RequestBody final PlanBody body) {
        if (body == null || body.target == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "TARGET_REQUIRED",
                "message", "target ISO-8601 timestamp required"));
        }
        try {
            return ResponseEntity.ok(wal.pitrPlan(Instant.parse(body.target)));
        } catch (final Exception ex) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "BAD_TARGET", "message", ex.getMessage()));
        }
    }

    /* ─── Verification ──────────────────────────────────────── */

    @GetMapping("/verify/status")
    public ResponseEntity<Map<String, Object>> verifyStatus() {
        return ResponseEntity.ok(verify.status());
    }

    @GetMapping("/verify/history")
    public ResponseEntity<Map<String, Object>> verifyHistory(
            @RequestParam(value = "limit", defaultValue = "25") final int limit) {
        return ResponseEntity.ok(Map.of("history", verify.history(limit)));
    }

    @PostMapping("/verify/run")
    public ResponseEntity<Map<String, Object>> verifyRun(
            @RequestParam(value = "backupId", required = false) final Long backupId) {
        return ResponseEntity.ok(verify.runVerification(backupId));
    }

    public static final class PlanBody {
        public String target;
    }
}
