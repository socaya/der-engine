package ug.ac.mak.der.web;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.backup.BackupRepository;
import ug.ac.mak.der.workflows.backup.BackupRun;

/**
 * FR-15-06..10: operational admin surface.
 * - /users/scope: FR-15-06
 * - /backup/trigger + /backup/verify: FR-15-07
 * - /settings: FR-15-08
 * - /support-bundle: FR-15-09
 * - /reports/operational: FR-15-10
 *
 * ADMIN-gated (SecurityConfig).
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/ops",
        produces = MediaType.APPLICATION_JSON_VALUE)
@ConditionalOnBean(EdgeUserRepository.class)
public class OperationsAdminController {

    private final EdgeUserRepository users;
    private final ObjectProvider<BackupRepository> backups;
    private final ObjectProvider<OperationJournalRepository> journal;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    public OperationsAdminController(final EdgeUserRepository users,
                                      final ObjectProvider<BackupRepository> backups,
                                      final ObjectProvider<OperationJournalRepository> journal,
                                      final SecurityAuditRepository audit,
                                      final ObjectMapper mapper,
                                      final Clock clock) {
        this.users = Objects.requireNonNull(users, "users");
        this.backups = Objects.requireNonNull(backups, "backups");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** FR-15-06: user scope viewer. */
    @GetMapping("/users/scope")
    public ResponseEntity<Map<String, Object>> userScope() {
        final List<Map<String, Object>> rows = users.findAll().stream()
                .map(this::userRow).toList();
        return ResponseEntity.ok(Map.of("users", rows,
                "generatedAt", Instant.now(clock).toString()));
    }

    private Map<String, Object> userRow(final EdgeUser u) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", u.userId().toString());
        m.put("username", u.username());
        m.put("displayName", u.displayName());
        m.put("roles", u.roles().stream().map(Enum::name).toList());
        m.put("origin", u.origin().name());
        m.put("disabled", u.disabled());
        m.put("createdAt", u.createdAt().toString());
        m.put("updatedAt", u.updatedAt().toString());
        m.put("permissionAgeHours", ChronoUnit.HOURS.between(u.updatedAt(), Instant.now(clock)));
        return m;
    }

    /** FR-15-07: trigger backup. */
    @PostMapping(path = "/backup/trigger", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> triggerBackup(
            final Authentication authentication,
            @RequestBody(required = false) final BackupTriggerRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final BackupRepository repo = backups.getIfAvailable();
        if (repo == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "BACKUP_UNAVAILABLE",
                    "message", "backup pipeline not wired"));
        }
        final BackupRun.Kind kind;
        try {
            kind = BackupRun.Kind.valueOf(body == null || body.kind() == null
                    ? "FULL" : body.kind().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "BACKUP_KIND_INVALID",
                    "message", "kind must be FULL or INCREMENTAL"));
        }
        final BackupRun run = new BackupRun(null, Instant.now(clock), principal.userId(),
                kind, BackupRun.Status.REQUESTED, null, null, null, null, null, null, null);
        final BackupRun stored = repo.insert(run);
        audit.append(new AuditEvent("BACKUP_TRIGGERED",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("kind", kind.name())), Instant.now(clock));
        return ResponseEntity.ok(Map.of("runId", stored.runId(), "kind", kind.name()));
    }

    /** FR-15-07: verify backup — summary of last 10 runs + success/fail counts. */
    @GetMapping("/backup/verify")
    public ResponseEntity<Map<String, Object>> verifyBackups() {
        final BackupRepository repo = backups.getIfAvailable();
        if (repo == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "BACKUP_UNAVAILABLE",
                    "message", "backup pipeline not wired"));
        }
        final List<BackupRun> runs = repo.findByStatus(BackupRun.Status.SUCCESS, 10);
        final List<BackupRun> failed = repo.findByStatus(BackupRun.Status.FAILED, 10);
        return ResponseEntity.ok(Map.of(
                "recentSuccess", runs.size(),
                "recentFailed", failed.size(),
                "lastSuccess", runs.isEmpty() ? null
                        : runs.get(0).startedAt().toString(),
                "lastFailure", failed.isEmpty() ? null
                        : failed.get(0).startedAt().toString()));
    }

    /** FR-15-08: configuration editor — exposes safe-to-edit runtime settings. */
    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> settings() {
        return ResponseEntity.ok(Map.of(
                "settings", Map.of(
                        "der.referral.inbox.cron", prop("der.referral.inbox.cron", "0 */10 * * * ?"),
                        "der.analytics.refresh.cron", prop("der.analytics.refresh.cron", "0 */5 * * * ?"),
                        "der.backup.enabled", prop("der.backup.enabled", "true"),
                        "der.backup.local.max-archives", prop("der.backup.local.max-archives", "50"),
                        "der.security.require-tls", prop("der.security.require-tls", "false"))));
    }

    private static String prop(final String key, final String fallback) {
        final String val = System.getProperty(key);
        return val == null ? fallback : val;
    }

    @PostMapping(path = "/settings", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> setSetting(final Authentication authentication,
                                                            @RequestBody final SettingsRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.key() == null || !isMutableKey(body.key())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "SETTINGS_KEY_UNKNOWN",
                    "message", "key not mutable through this endpoint"));
        }
        System.setProperty(body.key(), body.value() == null ? "" : body.value());
        audit.append(new AuditEvent("SETTINGS_CHANGED",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("key", body.key(), "value", String.valueOf(body.value()))),
                Instant.now(clock));
        return ResponseEntity.ok(Map.of("key", body.key(), "value", body.value()));
    }

    private static boolean isMutableKey(final String k) {
        return k.startsWith("der.referral.") || k.startsWith("der.analytics.")
                || k.startsWith("der.backup.") || k.startsWith("der.security.require-tls");
    }

    /** FR-15-09: support bundle — zipped sanitised diagnostics. */
    @GetMapping(path = "/support-bundle", produces = "application/zip")
    public void supportBundle(final Authentication authentication,
                                final HttpServletResponse response) throws IOException {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            response.setStatus(401);
            return;
        }
        response.setContentType("application/zip");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"der-support-bundle-"
                        + Instant.now(clock).toString().replace(":", "-") + ".zip\"");
        try (final OutputStream out = response.getOutputStream();
                final ZipOutputStream zip = new ZipOutputStream(out)) {
            putEntry(zip, "manifest.json", mapper.writeValueAsString(Map.of(
                    "generatedAt", Instant.now(clock).toString(),
                    "generatedBy", principal.userId().toString(),
                    "host", safeHostname(),
                    "javaVersion", System.getProperty("java.version"),
                    "osName", System.getProperty("os.name"))));
            putEntry(zip, "users.json", mapper.writeValueAsString(users.findAll().stream()
                    .map(this::userRow).toList()));
            final OperationJournalRepository jr = journal.getIfAvailable();
            if (jr != null) {
                final List<OperationJournalEntry> recent = jr.findPending(50);
                putEntry(zip, "journal-recent.json",
                        mapper.writeValueAsString(recent.stream()
                                .map(e -> Map.of("operationId", e.operationId().toString(),
                                        "entityType", e.entityType().name(),
                                        "state", e.state().name(),
                                        "attemptCount", e.attemptCount(),
                                        "createdAt", e.createdAt().toString()))
                                .toList()));
            }
        }
        audit.append(new AuditEvent("SUPPORT_BUNDLE_EXPORTED",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of()), Instant.now(clock));
    }

    private static void putEntry(final ZipOutputStream zip, final String name,
                                   final String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String safeHostname() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (java.net.UnknownHostException ex) {
            return "unknown";
        }
    }

    /** FR-15-10: operational report — local-only counts vs. central-confirmed. */
    @GetMapping("/reports/operational")
    public ResponseEntity<Map<String, Object>> operationalReport(
            @RequestParam(name = "since", required = false) final String sinceParam) {
        final OperationJournalRepository jr = journal.getIfAvailable();
        if (jr == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "REPORT_UNAVAILABLE",
                    "message", "journal unavailable"));
        }
        final Map<String, Integer> byState = new LinkedHashMap<>();
        for (final OperationJournalEntry.State s : OperationJournalEntry.State.values()) {
            byState.put(s.name(), jr.countByState(s));
        }
        return ResponseEntity.ok(Map.of(
                "generatedAt", Instant.now(clock).toString(),
                "byState", byState,
                "centralConfirmed", byState.getOrDefault(
                        OperationJournalEntry.State.CENTRAL_ACCEPTED.name(), 0),
                "localOnly", byState.getOrDefault(
                        OperationJournalEntry.State.PENDING.name(), 0)
                        + byState.getOrDefault(
                                OperationJournalEntry.State.RETRYABLE.name(), 0),
                "note", "Local-only totals never claim central authoritative acceptance (FR-15-10)."));
    }

    /**
     * FR-01-10: decommission — disable all other users, request a
     * final evidence-export backup, record a terminal audit event.
     * Body must carry {@code confirm=="CONFIRMED"}.
     */
    @PostMapping(path = "/decommission", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> decommission(
            final Authentication authentication,
            @RequestBody(required = false) final DecommissionRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || !"CONFIRMED".equals(body.confirm())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "DECOMMISSION_CONFIRM_REQUIRED",
                    "message", "body.confirm must equal CONFIRMED"));
        }
        int disabled = 0;
        for (final EdgeUser u : users.findAll()) {
            if (!u.disabled() && !u.userId().equals(principal.userId())) {
                users.setDisabled(u.userId(), true);
                disabled++;
            }
        }
        final BackupRepository repo = backups.getIfAvailable();
        boolean finalBackupRequested = false;
        if (repo != null) {
            repo.insert(new BackupRun(null, Instant.now(clock), principal.userId(),
                    BackupRun.Kind.FULL, BackupRun.Status.REQUESTED,
                    null, null, null, null, null, null, null));
            finalBackupRequested = true;
        }
        audit.append(new AuditEvent("DECOMMISSION",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("disabledUsers", String.valueOf(disabled),
                        "finalBackupRequested", String.valueOf(finalBackupRequested))),
                Instant.now(clock));
        return ResponseEntity.ok(Map.of(
                "disabledUsers", disabled,
                "finalBackupRequested", finalBackupRequested,
                "actedBy", principal.userId().toString()));
    }

    public record DecommissionRequest(@JsonProperty("confirm") String confirm) { }

    public record BackupTriggerRequest(@JsonProperty("kind") String kind) { }

    public record SettingsRequest(@JsonProperty("key") String key,
                                    @JsonProperty("value") String value) { }
}
