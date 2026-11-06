package ug.ac.mak.der.web;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;

import org.springframework.web.bind.annotation.PathVariable;
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

import ug.ac.mak.der.orgunit.ScopeAuditService;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;
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
    private final ObjectProvider<AggregateDataValueService> aggregates;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    private final ObjectProvider<ScopeAuditService> scopeAudit;

    public OperationsAdminController(final EdgeUserRepository users,
                                      final ObjectProvider<BackupRepository> backups,
                                      final ObjectProvider<OperationJournalRepository> journal,
                                      final ObjectProvider<AggregateDataValueService> aggregates,
                                      final SecurityAuditRepository audit,
                                      final ObjectMapper mapper,
                                      final Clock clock,
                                      final ObjectProvider<ScopeAuditService> scopeAudit) {
        this.users = Objects.requireNonNull(users, "users");
        this.backups = Objects.requireNonNull(backups, "backups");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.aggregates = Objects.requireNonNull(aggregates, "aggregates");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.scopeAudit = Objects.requireNonNull(scopeAudit, "scopeAudit");
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
     * FR-09-10: journal retention. Purges terminal-state entries
     * older than the given day cutoff (default 90).
     */
    @PostMapping(path = "/journal/purge")
    public ResponseEntity<Map<String, Object>> purgeJournal(
            final Authentication authentication,
            @RequestParam(name = "olderThanDays", defaultValue = "90") final int days) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final OperationJournalRepository jr = journal.getIfAvailable();
        if (jr == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "JOURNAL_UNAVAILABLE", "message", "journal not wired"));
        }
        // §2.3.119 R-AP — allow days=0 (purge every terminal row now)
        // so operators can clear the processed queue list in one click.
        final int capped = Math.max(0, days);
        final Instant cutoff = Instant.now(clock).minus(capped, java.time.temporal.ChronoUnit.DAYS);
        final int purged = jr.purgeTerminalBefore(cutoff);
        audit.append(new AuditEvent("JOURNAL_RETENTION_PURGE",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("olderThanDays", String.valueOf(capped),
                        "rowsPurged", String.valueOf(purged))),
                Instant.now(clock));
        return ResponseEntity.ok(Map.of("rowsPurged", purged, "cutoff", cutoff.toString()));
    }

    /**
     * §2.3.120 R-AQ — expose the most recent JOURNAL_RETENTION_PURGE
     * audit event so the queue UI can render a "last cleaned
     * {timestamp} · {n} rows" chip in the header. We pull from the
     * audit log rather than keeping a dedicated column so there is
     * exactly one authoritative record of what was purged and when.
     */
    @GetMapping(path = "/journal/last-purge")
    public ResponseEntity<Map<String, Object>> lastPurge(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final var rows = audit.findRecent("JOURNAL_RETENTION_PURGE", null, 1);
        if (rows.isEmpty()) {
            return ResponseEntity.ok(Map.of("observedAt", "", "rowsPurged", 0, "olderThanDays", 0));
        }
        final var row = rows.get(0);
        int rowsPurged = 0;
        int olderThanDays = 0;
        try {
            final var detail = mapper.readTree(row.detailJson());
            rowsPurged = detail.path("rowsPurged").asInt(0);
            olderThanDays = detail.path("olderThanDays").asInt(0);
        } catch (Exception ignored) {
            // Audit payload is operator-visible best-effort data —
            // malformed detail shouldn't null the chip, callers tolerate 0.
        }
        return ResponseEntity.ok(Map.of(
                "observedAt", row.observedAt().toString(),
                "rowsPurged", rowsPurged,
                "olderThanDays", olderThanDays));
    }

    /**
     * FR-05-10/11: move a drift-affected journal entry to
     * {@code CONFLICT_REVIEW} so the drain worker does not retry
     * against stale metadata definitions.
     */
    @PostMapping(path = "/journal/{opId}/quarantine")
    public ResponseEntity<Map<String, Object>> quarantineOperation(
            final Authentication authentication,
            @PathVariable("opId") final java.util.UUID opId,
            @RequestParam(value = "reason", defaultValue = "METADATA_DRIFT") final String reason) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final OperationJournalRepository jr = journal.getIfAvailable();
        if (jr == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "JOURNAL_UNAVAILABLE", "message", "journal not wired"));
        }
        final int n = jr.quarantine(opId, reason);
        if (n == 0) {
            return ResponseEntity.notFound().build();
        }
        audit.append(new AuditEvent("JOURNAL_QUARANTINE",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("opId", opId.toString(), "reason", reason)),
                Instant.now(clock));
        return ResponseEntity.ok(Map.of("operationId", opId.toString(),
                "state", "CONFLICT_REVIEW", "reason", reason));
    }

    /**
     * §2.3.125 — replay an aggregate form. Reads every local row for
     * (dataSet, orgUnit, period, aoc) and emits a brand-new PENDING
     * journal entry carrying the DHIS2 envelope so the drain worker
     * publishes the form again. Use when an admin notices a drain
     * that reported SUCCESS but central importCount was all zeros,
     * or when central silently rolled back a form after acceptance.
     *
     * <p>Unlike {@code /journal/{opId}/retry}, this creates a fresh
     * operation from the current local state — the journal remains
     * append-only, and the previous SUCCESS row is left intact as
     * provenance.</p>
     */
    @PostMapping(path = "/journal/aggregate/replay")
    public ResponseEntity<Map<String, Object>> replayAggregateForm(
            final Authentication authentication,
            @RequestParam("dataSet") final String dataSet,
            @RequestParam("orgUnit") final String orgUnit,
            @RequestParam("period") final String period,
            @RequestParam(value = "attributeOptionCombo", required = false)
                final String attributeOptionCombo) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final AggregateDataValueService svc = aggregates.getIfAvailable();
        if (svc == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "AGGREGATE_SERVICE_UNAVAILABLE",
                    "message", "aggregate service not wired"));
        }
        if (dataSet == null || dataSet.isBlank()
                || orgUnit == null || orgUnit.isBlank()
                || period == null || period.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "FORM_KEY_INCOMPLETE",
                    "message", "dataSet, orgUnit, period are all required"));
        }
        return svc.replayForm(
                dataSet.trim(), orgUnit.trim(), period.trim(),
                attributeOptionCombo, principal.userId(),
                null, null
        ).<ResponseEntity<Map<String, Object>>>map(opId -> ResponseEntity.ok(Map.of(
                "operationId", opId.toString(),
                "state", "PENDING",
                "dataSet", dataSet,
                "orgUnit", orgUnit,
                "period", period
        ))).orElseGet(() -> ResponseEntity.status(404).body(Map.of(
                "code", "FORM_HAS_NO_LOCAL_ROWS",
                "message", "no aggregate_data_value rows for that form key"
        )));
    }

    /**
     * §2.3.102 R-Q — Force-retry a single operation. Resets state to
     * PENDING + clears last_error so the next drain tick picks it up.
     * Only accepted on non-terminal non-pending states (RETRYABLE,
     * CENTRAL_REJECTED, CONFLICT_REVIEW, QUARANTINED, UNKNOWN_OUTCOME);
     * otherwise 409 so operators can't retry an already-synced row.
     */
    @PostMapping(path = "/journal/{opId}/retry")
    public ResponseEntity<Map<String, Object>> retryOperation(
            final Authentication authentication,
            @PathVariable("opId") final java.util.UUID opId) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final OperationJournalRepository jr = journal.getIfAvailable();
        if (jr == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "JOURNAL_UNAVAILABLE", "message", "journal not wired"));
        }
        final int n = jr.requeuePending(opId);
        if (n == 0) {
            return ResponseEntity.status(409).body(Map.of(
                    "code", "RETRY_NOT_APPLICABLE",
                    "message", "operation not found or in a terminal/already-pending state"));
        }
        audit.append(new AuditEvent("JOURNAL_RETRY",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("opId", opId.toString())),
                Instant.now(clock));
        return ResponseEntity.ok(Map.of(
                "operationId", opId.toString(),
                "state", "PENDING"));
    }

    /**
     * §2.3.103 R-T — Bulk force-retry every retryable operation for
     * one workflow run, optionally scoped to a comma-separated list
     * of states (defaults to the five retry-eligible states). Returns
     * the number of rows moved back to PENDING.
     *
     * <p>Example:
     * {@code POST /admin/ops/journal/retry-run?workflowRunId=<uuid>
     *                                             &state=CENTRAL_REJECTED}</p>
     */
    @PostMapping(path = "/journal/retry-run")
    public ResponseEntity<Map<String, Object>> retryRun(
            final Authentication authentication,
            @RequestParam("workflowRunId") final java.util.UUID workflowRunId,
            @RequestParam(value = "state", required = false) final String stateCsv) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final OperationJournalRepository jr = journal.getIfAvailable();
        if (jr == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "JOURNAL_UNAVAILABLE", "message", "journal not wired"));
        }
        final java.util.List<String> states = new java.util.ArrayList<>();
        if (stateCsv != null && !stateCsv.isBlank()) {
            for (final String s : stateCsv.split(",")) {
                final String t = s.trim();
                if (!t.isEmpty()) {
                    states.add(t);
                }
            }
        }
        final int n = jr.requeuePendingByRun(workflowRunId, states);
        audit.append(new AuditEvent("JOURNAL_RETRY_RUN",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("workflowRunId", workflowRunId.toString(),
                       "states", states.isEmpty() ? "<default>" : String.join(",", states),
                       "rowsRequeued", String.valueOf(n))),
                Instant.now(clock));
        return ResponseEntity.ok(Map.of(
                "workflowRunId", workflowRunId.toString(),
                "rowsRequeued", n));
    }

    /**
     * §2.3.105 R-Y — Bulk force-retry by operation id. Used by the
     * per-stream retry button inside the TEI payload-lineage drawer
     * where the operator targets a scoped set of ops rather than a
     * whole workflow run. Request body:
     *
     * <pre>{@code {"operationIds": ["<uuid>", "<uuid>", ...]}}</pre>
     *
     * Returns the number of rows actually moved to PENDING (op ids
     * already in a terminal/pending state are silently skipped).
     */
    @PostMapping(path = "/journal/retry-batch", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> retryBatch(
            final Authentication authentication,
            @RequestBody final RetryBatchRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.operationIds() == null || body.operationIds().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "OPERATION_IDS_REQUIRED",
                    "message", "operationIds[] is required"));
        }
        final OperationJournalRepository jr = journal.getIfAvailable();
        if (jr == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "JOURNAL_UNAVAILABLE", "message", "journal not wired"));
        }
        final java.util.List<java.util.UUID> ids = new java.util.ArrayList<>();
        for (final String s : body.operationIds()) {
            try {
                ids.add(java.util.UUID.fromString(s));
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "OPERATION_ID_INVALID",
                        "message", "not a UUID: " + s));
            }
        }
        final int n = jr.requeuePendingByIds(ids);
        audit.append(new AuditEvent("JOURNAL_RETRY_BATCH",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("operationCount", String.valueOf(ids.size()),
                       "rowsRequeued", String.valueOf(n))),
                Instant.now(clock));
        return ResponseEntity.ok(Map.of(
                "requested", ids.size(),
                "rowsRequeued", n));
    }

    public record RetryBatchRequest(
            @com.fasterxml.jackson.annotation.JsonProperty("operationIds")
                java.util.List<String> operationIds) { }

    /**
     * §2.3.115 R-AL — scope audit: locally-stored rows whose
     * {@code org_unit_uid} is outside the edge's bound OU subtree.
     *
     * <p>Returns:
     * <ul>
     *   <li>{@code boundOrgUnitId} / {@code boundOrgUnitPath} —
     *       the current binding (null when unbound; in that case
     *       counts + samples are both empty).</li>
     *   <li>{@code total} + {@code countsByEntityType} — row counts
     *       outside the subtree, bucketed by {@link
     *       ug.ac.mak.der.workflows.aggregate.OperationJournalEntry
     *       .EntityType}.</li>
     *   <li>{@code samplesByEntityType} — up to {@code sampleLimit}
     *       example rows per type (default 5, max 50).</li>
     * </ul>
     */
    @GetMapping(path = "/scope/audit")
    public ResponseEntity<Map<String, Object>> scopeAuditSnapshot(
            final Authentication authentication,
            @RequestParam(value = "sampleLimit", defaultValue = "5") final int sampleLimit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final ScopeAuditService svc = scopeAudit.getIfAvailable();
        if (svc == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "SCOPE_AUDIT_UNAVAILABLE",
                    "message", "scope audit requires an orgUnit binding service"));
        }
        final int capped = Math.max(0, Math.min(sampleLimit, 50));
        final var snap = svc.audit(capped);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("boundOrgUnitId",    snap.boundOrgUnitId());
        body.put("boundOrgUnitPath",  snap.boundOrgUnitPath());
        body.put("total",             snap.total());
        body.put("countsByEntityType", snap.countsByEntityType());
        body.put("samplesByEntityType", snap.samplesByEntityType());
        return ResponseEntity.ok(body);
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
