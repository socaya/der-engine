package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.CaptureWorkflow;
import ug.ac.mak.der.workflow.CaptureWorkflowContribution;
import ug.ac.mak.der.workflow.CaptureWorkflowContributionRepository;
import ug.ac.mak.der.workflow.CaptureWorkflowDependency;
import ug.ac.mak.der.workflow.CaptureWorkflowField;
import ug.ac.mak.der.workflow.CaptureWorkflowImportService;
import ug.ac.mak.der.workflow.CaptureWorkflowRun;
import ug.ac.mak.der.workflow.CaptureWorkflowService;
import ug.ac.mak.der.workflow.CaptureWorkflowStep;
import ug.ac.mak.der.workflow.ProgressiveValidator;
import ug.ac.mak.der.workflow.WorkflowInboxStream;
import ug.ac.mak.der.workflow.WorkflowPinningService;
import ug.ac.mak.der.fleet.UserPreferenceService;
import ug.ac.mak.der.workflow.WorkflowQueueStream;
import ug.ac.mak.der.workflow.WorkflowRunCoordinator;

/** ADR-0018 slice A capture-workflow REST surface. ADMIN-gated for writes. */
@RestController
@RequestMapping(path = "/edge-api/v1/workflows", produces = MediaType.APPLICATION_JSON_VALUE)
public class CaptureWorkflowController {

    private final CaptureWorkflowService svc;
    private final CaptureWorkflowImportService importer;
    private final CaptureWorkflowContributionRepository contributions;
    private final WorkflowRunCoordinator coordinator;
    private final ProgressiveValidator validator;
    private final WorkflowQueueStream queueStream;
    private final WorkflowPinningService pinning;
    private final UserPreferenceService prefs;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final WorkflowInboxStream inboxStream;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper
            = new com.fasterxml.jackson.databind.ObjectMapper();
    /** §2.3.31 — pref key for the operator's preferred device.
     *  When set, GET /queue auto-filters to it unless the caller
     *  supplies an explicit ?deviceId=. */
    public static final String PREF_PREFERRED_DEVICE = "workflow.preferredDeviceId";

    public CaptureWorkflowController(final CaptureWorkflowService svc,
                                       final CaptureWorkflowImportService importer,
                                       final CaptureWorkflowContributionRepository contributions,
                                       final WorkflowRunCoordinator coordinator,
                                       final ProgressiveValidator validator,
                                       final WorkflowQueueStream queueStream,
                                       final WorkflowPinningService pinning,
                                       final UserPreferenceService prefs,
                                       final org.springframework.jdbc.core.JdbcTemplate jdbc,
                                       final WorkflowInboxStream inboxStream) {
        this.svc = Objects.requireNonNull(svc, "svc");
        this.importer = Objects.requireNonNull(importer, "importer");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
        this.coordinator = Objects.requireNonNull(coordinator, "coordinator");
        this.validator = Objects.requireNonNull(validator, "validator");
        this.queueStream = Objects.requireNonNull(queueStream, "queueStream");
        this.pinning = Objects.requireNonNull(pinning, "pinning");
        this.prefs = Objects.requireNonNull(prefs, "prefs");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.inboxStream = Objects.requireNonNull(inboxStream, "inboxStream");
    }

    /** §2.3.41 — inbox SSE endpoint. */
    @GetMapping(path = "/import-inbox/stream",
                produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter
            inboxStream(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            final var em = new org.springframework.web.servlet
                    .mvc.method.annotation.SseEmitter(0L);
            em.completeWithError(new SecurityException("unauthenticated"));
            return em;
        }
        return inboxStream.register();
    }

    /** §37–§42 — read the workflow's pin. {@code snapshotId=null}
     *  means the workflow floats with the live mirror. */
    @GetMapping("/{id}/pinned-snapshot")
    public ResponseEntity<Map<String, Object>> getPin(@PathVariable("id") final UUID id) {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("workflowId", id.toString());
        body.put("snapshotId", pinning.getPinnedSnapshot(id).orElse(null));
        return ResponseEntity.ok(body);
    }

    /** §37–§42 — pin / unpin a workflow. {@code snapshotId=null}
     *  unpins. */
    @org.springframework.web.bind.annotation.PutMapping(
            path = "/{id}/pinned-snapshot",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> pin(
            final org.springframework.security.core.Authentication auth,
            @PathVariable("id") final UUID id,
            @org.springframework.web.bind.annotation.RequestBody final PinRequest body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        try {
            pinning.pin(id, body == null ? null : body.snapshotId(), principal.userId());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("workflowId", id.toString());
        out.put("snapshotId", body == null ? null : body.snapshotId());
        return ResponseEntity.ok(out);
    }

    public record PinRequest(Long snapshotId) { }

    /** §2.3.24 — SSE: push a {@code queue.invalidate} event whenever a
     *  workflow run moves, so the UI can skip the 15 s polling loop. */
    @GetMapping(path = "/queue/stream",
                produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter queueStream(
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            // Can't return a 401 as the body of an SSE response — the
            // caller will see the connection close immediately.
            final var em = new org.springframework.web.servlet
                    .mvc.method.annotation.SseEmitter(0L);
            em.completeWithError(new SecurityException("unauthenticated"));
            return em;
        }
        return queueStream.register();
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        return ResponseEntity.ok(Map.of("workflows",
                svc.list().stream().map(CaptureWorkflowController::toJson).toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable("id") final UUID id) {
        return svc.get(id)
                .<ResponseEntity<Map<String, Object>>>map(w -> ResponseEntity.ok(toJson(w)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> create(final Authentication authentication,
                                                        @RequestBody final WorkflowRequest body) {
        return save(authentication, body, null);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> update(final Authentication authentication,
                                                        @PathVariable("id") final UUID id,
                                                        @RequestBody final WorkflowRequest body) {
        return save(authentication, body, id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") final UUID id) {
        final int rows = svc.delete(id);
        return rows == 0 ? ResponseEntity.notFound().build() : ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/runs")
    public ResponseEntity<Map<String, Object>> runs(@PathVariable("id") final UUID id) {
        return ResponseEntity.ok(Map.of("runs",
                svc.runs(id).stream().map(CaptureWorkflowController::runToJson).toList()));
    }

    /**
     * Operator work queue (spec §51–§52). Returns every step across all
     * active runs that is READY or BLOCKED and that the caller is
     * entitled to see, newest-first.
     *
     * Entitlement: ADMIN sees everything. OPERATOR/REVIEWER see steps
     * whose {@code ownerRole} matches one of their granted roles, or
     * steps bound to a device the caller owns (that filter lands when
     * device ownership is on the principal — for now, ADMINs see all,
     * operators see steps matching their role).
     */
    @GetMapping("/queue")
    public ResponseEntity<Map<String, Object>> queue(
            final Authentication authentication,
            @org.springframework.web.bind.annotation.RequestParam(
                    name = "deviceId", required = false) final UUID deviceId,
            @org.springframework.web.bind.annotation.RequestParam(
                    name = "allDevices", required = false,
                    defaultValue = "false") final boolean allDevices) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final boolean isAdmin = principal.roleNames().contains("ADMIN");
        // §2.3.31 — auto-scope: if the operator has set a preferred
        // device and didn't opt out via ?allDevices=true, use that pref.
        UUID effectiveDeviceId = deviceId;
        if (effectiveDeviceId == null && !allDevices) {
            final var pref = prefs.read(principal.userId(), PREF_PREFERRED_DEVICE);
            if (pref.isPresent()) {
                try {
                    effectiveDeviceId = UUID.fromString(pref.get());
                } catch (IllegalArgumentException ex) {
                    // Corrupt pref — ignore, fall back to all-devices.
                }
            }
        }
        final UUID appliedDeviceId = effectiveDeviceId;
        final List<Map<String, Object>> rows = new ArrayList<>();
        final java.util.Set<UUID> activeRunIds = new java.util.LinkedHashSet<>();
        for (final CaptureWorkflow w : svc.list()) {
            if (!w.enabled()) {
                continue;
            }
            final List<CaptureWorkflowRun> runs = svc.runs(w.workflowId());
            for (final CaptureWorkflowRun r : runs) {
                if (r.state() != CaptureWorkflowRun.State.OPEN
                        && r.state() != CaptureWorkflowRun.State.AWAITING) {
                    continue;
                }
                final List<CaptureWorkflowContribution> contribs =
                        contributions.findByRun(r.runId());
                final Map<UUID, WorkflowRunCoordinator.Readiness> readiness =
                        coordinator.computeReadiness(w, contribs);
                for (final CaptureWorkflowStep s : w.steps()) {
                    final WorkflowRunCoordinator.Readiness k = readiness.get(s.stepId());
                    if (k != WorkflowRunCoordinator.Readiness.READY
                            && k != WorkflowRunCoordinator.Readiness.BLOCKED) {
                        continue;
                    }
                    if (!isAdmin && !principal.roleNames().contains(s.ownerRole().name())) {
                        continue;
                    }
                    // §2.3.24 + §2.3.31 + §2.3.46 — device scope.
                    // Strict: when a scope is active, only expose
                    // steps bound to that device OR shared steps
                    // (ownerDeviceId=null). Steps bound to a *different*
                    // device are hidden.
                    if (appliedDeviceId != null && s.ownerDeviceId() != null
                            && !s.ownerDeviceId().equals(appliedDeviceId)) {
                        continue;
                    }
                    final Map<String, Object> row = new LinkedHashMap<>();
                    row.put("runId", r.runId().toString());
                    row.put("workflowId", w.workflowId().toString());
                    row.put("workflowName", w.displayName());
                    row.put("businessKey", r.businessKey());
                    row.put("stepId", s.stepId().toString());
                    row.put("stepOrdinal", s.ordinal());
                    row.put("stepName", s.displayName());
                    row.put("ownerRole", s.ownerRole().name());
                    row.put("ownerDeviceId", s.ownerDeviceId() == null
                            ? null : s.ownerDeviceId().toString());
                    row.put("readiness", k.name());
                    row.put("runCreatedAt", r.createdAt().toString());
                    row.put("runUpdatedAt", r.updatedAt().toString());
                    row.put("validationErrorCount", 0); // filled in after loop
                    rows.add(row);
                    activeRunIds.add(r.runId());
                }
            }
        }
        // Second pass — stamp validation error counts per run.
        final Map<UUID, Integer> errorCounts = validator.errorCountsForRuns(activeRunIds);
        rows.forEach((row) -> {
            final UUID runId = UUID.fromString((String) row.get("runId"));
            final Integer n = errorCounts.get(runId);
            row.put("validationErrorCount", n == null ? 0 : n);
        });
        // Newest runs first — operators triage the latest work.
        rows.sort((a, b) -> ((String) b.get("runUpdatedAt"))
                .compareTo((String) a.get("runUpdatedAt")));
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("rows", rows);
        out.put("appliedDeviceId", appliedDeviceId == null
                ? null : appliedDeviceId.toString());
        out.put("deviceScopeSource",
                deviceId != null ? "QUERY"
                : (appliedDeviceId != null ? "PREFERENCE" : "NONE"));
        return ResponseEntity.ok(out);
    }

    @GetMapping("/runs/{runId}/contributions")
    public ResponseEntity<Map<String, Object>> contributionsForRun(
            @PathVariable("runId") final UUID runId) {
        final List<Map<String, Object>> rows = contributions.findByRun(runId).stream()
                .map(CaptureWorkflowController::contributionJson).toList();
        return ResponseEntity.ok(Map.of("contributions", rows));
    }

    private static Map<String, Object> contributionJson(final CaptureWorkflowContribution c) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("contributionId", c.contributionId().toString());
        m.put("runId", c.runId().toString());
        m.put("stepId", c.stepId().toString());
        m.put("submittedBy", c.submittedBy() == null ? null : c.submittedBy().toString());
        m.put("submittedDeviceId", c.submittedDeviceId() == null
                ? null : c.submittedDeviceId().toString());
        m.put("submittedAt", c.submittedAt().toString());
        return m;
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<Map<String, Object>> export(@PathVariable("id") final UUID id) {
        return svc.get(id)
                .<ResponseEntity<Map<String, Object>>>map(w -> ResponseEntity.ok(toCanonicalJson(w)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(path = "/import", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> importWorkflow(
            final Authentication authentication,
            @org.springframework.web.bind.annotation.RequestParam(
                    name = "dryRun", defaultValue = "false") final boolean dryRun,
            @org.springframework.web.bind.annotation.RequestParam(
                    name = "inbox", defaultValue = "false") final boolean toInbox,
            @org.springframework.web.bind.annotation.RequestParam(
                    name = "fromLabel", required = false) final String fromLabel,
            @RequestBody final CaptureWorkflowImportService.CanonicalWorkflow body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        // §2.3.38 — inbox mode. Park the canonical doc as PENDING; an
        // operator on this edge reviews + accepts via /import-inbox.
        if (toInbox) {
            final UUID importId = UUID.randomUUID();
            try {
                final String payload = mapper.writeValueAsString(body);
                inboxJdbc().update(
                    "INSERT INTO der.workflow_import_inbox "
                            + "(import_id, received_by, from_label, display_name, "
                            + " bound_kind, bound_id, canonical_json, status) "
                            + "VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), 'PENDING')",
                    importId, principal.userId(), fromLabel,
                    body.displayName(), body.boundMetadataKind(),
                    body.boundMetadataId(), payload);
                inboxStream.notifyUpdate("import.received");
                return ResponseEntity.ok(Map.of(
                        "status", "PENDING_REVIEW",
                        "importId", importId.toString(),
                        "displayName", body.displayName()));
            } catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "INBOX_WRITE_FAILED",
                        "message", ex.getMessage()));
            }
        }
        try {
            final CaptureWorkflowImportService.ImportResult result =
                    importer.importWorkflow(body, dryRun, principal.userId());
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("dryRun", result.dryRun());
            out.put("warnings", result.warnings());
            out.put("workflow", toJson(result.workflow()));
            return ResponseEntity.ok(out);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "WORKFLOW_IMPORT_INVALID", "message", ex.getMessage()));
        }
    }

    private org.springframework.jdbc.core.JdbcTemplate inboxJdbc() {
        return jdbc;
    }

    /** §2.3.38 — list pending (default) / all import inbox rows. */
    @GetMapping("/import-inbox")
    public ResponseEntity<Map<String, Object>> inboxList(
            @org.springframework.web.bind.annotation.RequestParam(
                    name = "status", required = false) final String status) {
        final String sql = status == null
                ? "SELECT * FROM der.workflow_import_inbox "
                        + "ORDER BY received_at DESC LIMIT 200"
                : "SELECT * FROM der.workflow_import_inbox "
                        + "WHERE status = ? ORDER BY received_at DESC LIMIT 200";
        final List<Map<String, Object>> rows = status == null
                ? jdbc.query(sql, (rs, i) -> inboxRow(rs))
                : jdbc.query(sql, (rs, i) -> inboxRow(rs), status);
        return ResponseEntity.ok(Map.of("entries", rows));
    }

    @PostMapping("/import-inbox/{importId}/accept")
    public ResponseEntity<Map<String, Object>> inboxAccept(
            final Authentication auth,
            @PathVariable final UUID importId) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final List<String> payloads = jdbc.queryForList(
                "SELECT canonical_json::text FROM der.workflow_import_inbox "
                        + "WHERE import_id = ? AND status = 'PENDING'",
                String.class, importId);
        if (payloads.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        try {
            final CaptureWorkflowImportService.CanonicalWorkflow doc =
                    mapper.readValue(payloads.get(0),
                            CaptureWorkflowImportService.CanonicalWorkflow.class);
            final CaptureWorkflowImportService.ImportResult result =
                    importer.importWorkflow(doc, false, principal.userId());
            jdbc.update(
                    "UPDATE der.workflow_import_inbox "
                            + "SET status = 'ACCEPTED', decided_at = now(), "
                            + "    decided_by = ?, accepted_workflow_id = ? "
                            + "WHERE import_id = ?",
                    principal.userId(), result.workflow().workflowId(), importId);
            inboxStream.notifyUpdate("import.accepted");
            return ResponseEntity.ok(Map.of(
                    "importId", importId.toString(),
                    "workflowId", result.workflow().workflowId().toString(),
                    "warnings", result.warnings()));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INBOX_ACCEPT_FAILED", "message", ex.getMessage()));
        }
    }

    @PostMapping("/import-inbox/{importId}/reject")
    public ResponseEntity<Map<String, Object>> inboxReject(
            final Authentication auth,
            @PathVariable final UUID importId,
            @RequestBody(required = false) final Map<String, String> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final String note = body == null ? null : body.get("note");
        final int n = jdbc.update(
                "UPDATE der.workflow_import_inbox "
                        + "SET status = 'REJECTED', decided_at = now(), "
                        + "    decided_by = ?, decision_note = ? "
                        + "WHERE import_id = ? AND status = 'PENDING'",
                principal.userId(), note, importId);
        if (n == 0) {
            return ResponseEntity.notFound().build();
        }
        inboxStream.notifyUpdate("import.rejected");
        return ResponseEntity.ok(Map.of("importId", importId.toString(),
                                          "status", "REJECTED"));
    }

    /** §2.3.39 — compute a step-level diff between an inbox PENDING
     *  entry and the local workflow it would replace. "Local" is
     *  resolved by matching {@code boundMetadataKind:boundMetadataId}
     *  first, falling back to {@code displayName}. */
    @GetMapping("/import-inbox/{importId}/diff")
    public ResponseEntity<Map<String, Object>> inboxDiff(
            @PathVariable final UUID importId) {
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT display_name, bound_kind, bound_id, canonical_json::text "
                        + "FROM der.workflow_import_inbox WHERE import_id = ?",
                (rs, i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("displayName", rs.getString(1));
                    m.put("boundKind", rs.getString(2));
                    m.put("boundId", rs.getString(3));
                    m.put("payload", rs.getString(4));
                    return m;
                },
                importId);
        if (rows.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> entry = rows.get(0);
        // Resolve a local candidate.
        final String kind = (String) entry.get("boundKind");
        final String bound = (String) entry.get("boundId");
        final String name = (String) entry.get("displayName");
        CaptureWorkflow local = null;
        String matchStrategy = "NONE";
        for (final CaptureWorkflow w : svc.list()) {
            if (w.boundMetadataKind().name().equals(kind)
                    && w.boundMetadataId().equals(bound)) {
                local = w;
                matchStrategy = "BINDING";
                break;
            }
        }
        if (local == null) {
            for (final CaptureWorkflow w : svc.list()) {
                if (w.displayName().equalsIgnoreCase(name)) {
                    local = w;
                    matchStrategy = "DISPLAY_NAME";
                    break;
                }
            }
        }
        // Parse the canonical doc so we can line steps up.
        final CaptureWorkflowImportService.CanonicalWorkflow doc;
        try {
            doc = mapper.readValue((String) entry.get("payload"),
                    CaptureWorkflowImportService.CanonicalWorkflow.class);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "CANONICAL_INVALID", "message", ex.getMessage()));
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("importId", importId.toString());
        out.put("incoming", Map.of(
                "displayName", doc.displayName(),
                "boundKind", doc.boundMetadataKind(),
                "boundId", doc.boundMetadataId(),
                "stepCount", doc.steps() == null ? 0 : doc.steps().size()));
        out.put("matchStrategy", matchStrategy);
        if (local == null) {
            out.put("summary", "NEW_WORKFLOW");
            out.put("local", null);
            return ResponseEntity.ok(out);
        }
        out.put("local", Map.of(
                "workflowId", local.workflowId().toString(),
                "displayName", local.displayName(),
                "stepCount", local.steps().size()));
        // Compare steps by ordinal + displayName + sectionKind + sectionRef.
        final java.util.List<Map<String, Object>> added = new ArrayList<>();
        final java.util.List<Map<String, Object>> removed = new ArrayList<>();
        final java.util.List<Map<String, Object>> changed = new ArrayList<>();
        final Map<Integer, CaptureWorkflowStep> localByOrd = new HashMap<>();
        for (final CaptureWorkflowStep s : local.steps()) {
            localByOrd.put(s.ordinal(), s);
        }
        final Map<Integer, CaptureWorkflowImportService.CanonicalStep> incomingByOrd =
                new HashMap<>();
        if (doc.steps() != null) {
            doc.steps().forEach((s) -> incomingByOrd.put(s.ordinal(), s));
        }
        for (final var inc : incomingByOrd.entrySet()) {
            final var lo = localByOrd.get(inc.getKey());
            final var is = inc.getValue();
            if (lo == null) {
                added.add(Map.of("ordinal", inc.getKey(),
                        "displayName", is.displayName(),
                        "stepKind", is.stepKind() == null ? "" : is.stepKind(),
                        "fieldCount", is.fields().size()));
            } else if (!safeEq(lo.displayName(), is.displayName())
                    || !safeEq(lo.stepKind() == null ? null : lo.stepKind().name(), is.stepKind())
                    || lo.fields().size() != is.fields().size()) {
                changed.add(Map.of("ordinal", inc.getKey(),
                        "local", Map.of(
                            "displayName", lo.displayName(),
                            "stepKind", lo.stepKind() == null ? "" : lo.stepKind().name(),
                            "fieldCount", lo.fields().size()),
                        "incoming", Map.of(
                            "displayName", is.displayName(),
                            "stepKind", is.stepKind() == null ? "" : is.stepKind(),
                            "fieldCount", is.fields().size())));
            }
        }
        for (final var lo : localByOrd.entrySet()) {
            if (!incomingByOrd.containsKey(lo.getKey())) {
                final var s = lo.getValue();
                removed.add(Map.of("ordinal", lo.getKey(),
                        "displayName", s.displayName(),
                        "stepKind", s.stepKind() == null ? "" : s.stepKind().name()));
            }
        }
        out.put("added", added);
        out.put("removed", removed);
        out.put("changed", changed);
        out.put("summary",
                added.isEmpty() && removed.isEmpty() && changed.isEmpty()
                        ? "NO_CHANGES"
                        : "REPLACEMENT");
        return ResponseEntity.ok(out);
    }

    private static boolean safeEq(final String a, final String b) {
        return a == null ? b == null : a.equals(b);
    }

    private Map<String, Object> inboxRow(final java.sql.ResultSet rs)
            throws java.sql.SQLException {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("importId", rs.getString("import_id"));
        m.put("receivedAt", rs.getTimestamp("received_at").toInstant().toString());
        m.put("fromLabel", rs.getString("from_label"));
        m.put("displayName", rs.getString("display_name"));
        m.put("boundKind", rs.getString("bound_kind"));
        m.put("boundId", rs.getString("bound_id"));
        m.put("status", rs.getString("status"));
        final var decidedAt = rs.getTimestamp("decided_at");
        m.put("decidedAt", decidedAt == null ? null : decidedAt.toInstant().toString());
        m.put("decidedBy", rs.getString("decided_by"));
        m.put("decisionNote", rs.getString("decision_note"));
        m.put("acceptedWorkflowId", rs.getString("accepted_workflow_id"));
        return m;
    }

    private static Map<String, Object> toCanonicalJson(final CaptureWorkflow w) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("schemaVersion", 1);
        m.put("displayName", w.displayName());
        m.put("boundMetadataKind", w.boundMetadataKind().name());
        m.put("boundMetadataId", w.boundMetadataId());
        m.put("enabled", w.enabled());
        m.put("steps", w.steps().stream().map(CaptureWorkflowController::stepCanonical).toList());
        final List<Map<String, Object>> deps = new ArrayList<>();
        for (final CaptureWorkflowDependency d : w.dependencies()) {
            final Integer from = ordinalFor(w, d.stepId());
            final Integer to = ordinalFor(w, d.dependsOnStepId());
            if (from == null || to == null) {
                continue;
            }
            final Map<String, Object> dj = new LinkedHashMap<>();
            dj.put("fromOrdinal", from);
            dj.put("toOrdinal", to);
            dj.put("kind", d.kind().name());
            deps.add(dj);
        }
        m.put("dependencies", deps);
        return m;
    }

    private static Map<String, Object> stepCanonical(final CaptureWorkflowStep s) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("ordinal", s.ordinal());
        m.put("displayName", s.displayName());
        m.put("ownerRole", s.ownerRole().name());
        m.put("ownerDeviceId", s.ownerDeviceId() == null ? null : s.ownerDeviceId().toString());
        m.put("stepKind", s.stepKind().name());
        m.put("fields", s.fields().stream().map(f -> Map.of(
                "fieldRef", f.fieldRef(), "requirement", f.requirement().name())).toList());
        return m;
    }

    private static Integer ordinalFor(final CaptureWorkflow w, final UUID stepId) {
        return w.steps().stream()
                .filter(s -> s.stepId().equals(stepId))
                .map(CaptureWorkflowStep::ordinal)
                .findFirst()
                .orElse(null);
    }

    private ResponseEntity<Map<String, Object>> save(final Authentication authentication,
                                                        final WorkflowRequest body,
                                                        final UUID pathId) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.displayName() == null || body.displayName().isBlank()
                || body.boundMetadataId() == null || body.boundMetadataId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "WORKFLOW_INVALID",
                    "message", "displayName + boundMetadataId required"));
        }
        try {
            final UUID id = pathId != null ? pathId
                    : body.workflowId() != null ? body.workflowId() : UUID.randomUUID();
            final CaptureWorkflow.BindingKind kind = CaptureWorkflow.BindingKind.valueOf(
                    body.boundMetadataKind() == null ? "DATA_SET"
                            : body.boundMetadataKind().toUpperCase(java.util.Locale.ROOT));
            final List<CaptureWorkflowStep> steps = new ArrayList<>();
            final List<CaptureWorkflowDependency> deps = new ArrayList<>();
            if (body.steps() != null) {
                for (final StepRequest s : body.steps()) {
                    final UUID stepId = s.stepId() == null ? UUID.randomUUID() : s.stepId();
                    final List<CaptureWorkflowField> fields = new ArrayList<>();
                    if (s.fields() != null) {
                        for (final FieldRequest f : s.fields()) {
                            fields.add(new CaptureWorkflowField(stepId, f.fieldRef(),
                                    CaptureWorkflowField.Requirement.valueOf(
                                            f.requirement().toUpperCase(java.util.Locale.ROOT))));
                        }
                    }
                    final CaptureWorkflowStep.SectionKind sk = s.sectionKind() == null
                            ? CaptureWorkflowStep.SectionKind.AD_HOC
                            : CaptureWorkflowStep.SectionKind.valueOf(
                                    s.sectionKind().toUpperCase(java.util.Locale.ROOT));
                    steps.add(new CaptureWorkflowStep(stepId, id, s.ordinal(), s.displayName(),
                            CaptureWorkflowStep.OwnerRole.valueOf(
                                    s.ownerRole().toUpperCase(java.util.Locale.ROOT)),
                            s.ownerDeviceId(),
                            CaptureWorkflowStep.StepKind.valueOf(
                                    s.stepKind().toUpperCase(java.util.Locale.ROOT)),
                            fields,
                            sk,
                            s.sectionRef()));
                }
            }
            // V045 — validate section_kind matches bound_metadata_kind.
            final CaptureWorkflow.BindingKind bk = CaptureWorkflow.BindingKind.valueOf(
                    body.boundMetadataKind() == null ? "DATA_SET"
                            : body.boundMetadataKind().toUpperCase(java.util.Locale.ROOT));
            for (final CaptureWorkflowStep step : steps) {
                if (!sectionKindCompatible(bk, step.sectionKind())) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "code", "SECTION_KIND_INVALID",
                            "message", "step '" + step.displayName()
                                + "' sectionKind=" + step.sectionKind()
                                + " is not valid for a " + bk + " workflow"));
                }
            }
            if (body.dependencies() != null) {
                for (final DependencyRequest d : body.dependencies()) {
                    deps.add(new CaptureWorkflowDependency(d.stepId(), d.dependsOnStepId(),
                            CaptureWorkflowDependency.Kind.valueOf(
                                    d.kind().toUpperCase(java.util.Locale.ROOT))));
                }
            }
            final CaptureWorkflow incoming = new CaptureWorkflow(id, body.displayName(),
                    kind, body.boundMetadataId(), body.enabled(), 1,
                    Instant.now(), Instant.now(), principal.userId(), steps, deps,
                    body.requiresApproval(), body.defaultDeviceId());
            return ResponseEntity.ok(toJson(svc.save(incoming, principal.userId())));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "WORKFLOW_INVALID", "message", ex.getMessage()));
        }
    }

    private static Map<String, Object> toJson(final CaptureWorkflow w) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("workflowId", w.workflowId().toString());
        m.put("displayName", w.displayName());
        m.put("boundMetadataKind", w.boundMetadataKind().name());
        m.put("boundMetadataId", w.boundMetadataId());
        m.put("enabled", w.enabled());
        m.put("version", w.version());
        m.put("createdAt", w.createdAt() == null ? null : w.createdAt().toString());
        m.put("updatedAt", w.updatedAt() == null ? null : w.updatedAt().toString());
        m.put("requiresApproval", w.requiresApproval());
        m.put("defaultDeviceId", w.defaultDeviceId() == null ? null
                : w.defaultDeviceId().toString());
        m.put("steps", w.steps().stream().map(CaptureWorkflowController::stepJson).toList());
        m.put("dependencies", w.dependencies().stream()
                .map(CaptureWorkflowController::depJson).toList());
        return m;
    }

    private static Map<String, Object> stepJson(final CaptureWorkflowStep s) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("stepId", s.stepId().toString());
        m.put("ordinal", s.ordinal());
        m.put("displayName", s.displayName());
        m.put("ownerRole", s.ownerRole().name());
        m.put("ownerDeviceId", s.ownerDeviceId() == null ? null : s.ownerDeviceId().toString());
        m.put("stepKind", s.stepKind().name());
        m.put("sectionKind", s.sectionKind().name());
        m.put("sectionRef", s.sectionRef());
        m.put("fields", s.fields().stream().map(f -> Map.of(
                "fieldRef", f.fieldRef(), "requirement", f.requirement().name())).toList());
        return m;
    }

    /** V045 — which section kinds are legal for a given workflow parent. */
    private static boolean sectionKindCompatible(
            final CaptureWorkflow.BindingKind binding,
            final CaptureWorkflowStep.SectionKind section) {
        if (section == CaptureWorkflowStep.SectionKind.AD_HOC) {
            return true;
        }
        // V049 / V050 — ATTRIBUTE_OPTION_COMBO and ORG_UNIT_SCOPE are
        // cross-cutting; legal under every parent binding since
        // aggregate dataValues, event programs and tracker enrollments
        // all carry both an AOC UID and an orgUnit UID in the compiled
        // DHIS2 payload.
        if (section == CaptureWorkflowStep.SectionKind.ATTRIBUTE_OPTION_COMBO
                || section == CaptureWorkflowStep.SectionKind.ORG_UNIT_SCOPE) {
            return true;
        }
        return switch (binding) {
            case DATA_SET -> section == CaptureWorkflowStep.SectionKind.DATASET_SECTION
                    || section == CaptureWorkflowStep.SectionKind.DATA_ELEMENT_GROUP
                    || section == CaptureWorkflowStep.SectionKind.COC_SPLIT
                    || section == CaptureWorkflowStep.SectionKind.DATASET_ELEMENT
                    || section == CaptureWorkflowStep.SectionKind.PERIOD_SCOPE;
            case PROGRAM -> section == CaptureWorkflowStep.SectionKind.PROGRAM_STAGE
                    || section == CaptureWorkflowStep.SectionKind.PROGRAM_STAGE_SECTION
                    || section == CaptureWorkflowStep.SectionKind.TEI_ATTRIBUTE_GROUP
                    || section == CaptureWorkflowStep.SectionKind.DATA_ELEMENT_GROUP
                    || section == CaptureWorkflowStep.SectionKind.ENROLLMENT_FORM
                    || section == CaptureWorkflowStep.SectionKind.PROGRAM_SECTION
                    || section == CaptureWorkflowStep.SectionKind.TEI_TYPE_ATTRIBUTES
                    || section == CaptureWorkflowStep.SectionKind.RELATIONSHIP
                    || section == CaptureWorkflowStep.SectionKind.EVENT_INSTANCE;
            case PROGRAM_STAGE -> section == CaptureWorkflowStep.SectionKind.PROGRAM_STAGE_SECTION
                    || section == CaptureWorkflowStep.SectionKind.DATA_ELEMENT_GROUP
                    || section == CaptureWorkflowStep.SectionKind.EVENT_INSTANCE;
            case PROGRAM_STAGE_SECTION -> section == CaptureWorkflowStep.SectionKind.DATA_ELEMENT_GROUP
                    || section == CaptureWorkflowStep.SectionKind.EVENT_INSTANCE;
        };
    }

    private static Map<String, Object> depJson(final CaptureWorkflowDependency d) {
        return Map.of("stepId", d.stepId().toString(),
                "dependsOnStepId", d.dependsOnStepId().toString(),
                "kind", d.kind().name());
    }

    private static Map<String, Object> runToJson(final CaptureWorkflowRun r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("runId", r.runId().toString());
        m.put("workflowVersion", r.workflowVersion());
        m.put("businessKey", r.businessKey());
        m.put("currentStepId", r.currentStepId() == null ? null : r.currentStepId().toString());
        m.put("state", r.state().name());
        m.put("createdAt", r.createdAt().toString());
        return m;
    }

    public record WorkflowRequest(
            @JsonProperty("workflowId") UUID workflowId,
            @JsonProperty("displayName") String displayName,
            @JsonProperty("boundMetadataKind") String boundMetadataKind,
            @JsonProperty("boundMetadataId") String boundMetadataId,
            @JsonProperty("enabled") boolean enabled,
            @JsonProperty("steps") List<StepRequest> steps,
            @JsonProperty("dependencies") List<DependencyRequest> dependencies,
            @JsonProperty("requiresApproval") boolean requiresApproval,
            @JsonProperty("defaultDeviceId") UUID defaultDeviceId) { }

    public record StepRequest(
            @JsonProperty("stepId") UUID stepId,
            @JsonProperty("ordinal") int ordinal,
            @JsonProperty("displayName") String displayName,
            @JsonProperty("ownerRole") String ownerRole,
            @JsonProperty("ownerDeviceId") UUID ownerDeviceId,
            @JsonProperty("stepKind") String stepKind,
            @JsonProperty("fields") List<FieldRequest> fields,
            @JsonProperty("sectionKind") String sectionKind,
            @JsonProperty("sectionRef") String sectionRef) { }

    public record FieldRequest(
            @JsonProperty("fieldRef") String fieldRef,
            @JsonProperty("requirement") String requirement) { }

    public record DependencyRequest(
            @JsonProperty("stepId") UUID stepId,
            @JsonProperty("dependsOnStepId") UUID dependsOnStepId,
            @JsonProperty("kind") String kind) { }
}
