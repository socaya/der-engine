package ug.ac.mak.der.web;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.device.EdgeDeviceRepository;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.CaptureWorkflow;
import ug.ac.mak.der.workflow.CaptureWorkflowService;
import ug.ac.mak.der.workflow.CaptureWorkflowStep;

/**
 * §2.3.61 — admin troubleshooting surface. Aggregates the three
 * trouble-signals an admin follows up on:
 *
 * <ul>
 *   <li><b>Feed</b> — recent step transitions enriched with workflow /
 *       step / device names.</li>
 *   <li><b>Blockages</b> — currently BLOCKED steps + which predecessor
 *       is holding each one up + how long it has been blocked.</li>
 *   <li><b>Issues</b> — unresolved validation issues across all open
 *       runs.</li>
 *   <li><b>Conflicts</b> — unresolved divergent-identity conflicts.</li>
 * </ul>
 *
 * All endpoints are ADMIN-only (see {@code SecurityConfig}).
 */
@RestController
@RequestMapping(path = "/edge-api/v1/workflows/activity",
                 produces = MediaType.APPLICATION_JSON_VALUE)
public class WorkflowActivityController {

    private final JdbcTemplate jdbc;
    private final CaptureWorkflowService workflows;
    private final EdgeDeviceRepository devices;

    public WorkflowActivityController(final JdbcTemplate jdbc,
                                        final CaptureWorkflowService workflows,
                                        final EdgeDeviceRepository devices) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.devices = Objects.requireNonNull(devices, "devices");
    }

    /** Recent step transitions enriched for human reading. */
    @GetMapping("/feed")
    public ResponseEntity<Map<String, Object>> feed(final Authentication auth,
            @RequestParam(name = "limit", defaultValue = "50") final int limit) {
        requireAdmin(auth);
        final int safe = Math.max(1, Math.min(limit, 500));
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT t.transition_id, t.workflow_id, t.run_id, t.step_id, "
                + "       t.from_state, t.to_state, t.transitioned_at, "
                + "       t.actor_device_id, t.actor_user_id, "
                + "       r.business_key AS business_key "
                + "  FROM der.capture_workflow_step_transition t "
                + "  JOIN der.capture_workflow_run r ON r.run_id = t.run_id "
                + " ORDER BY t.transitioned_at DESC, t.transition_id DESC "
                + " LIMIT ?",
                (rs, i) -> {
                    final UUID workflowId = (UUID) rs.getObject("workflow_id");
                    final UUID stepId = (UUID) rs.getObject("step_id");
                    final UUID deviceId = (UUID) rs.getObject("actor_device_id");
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("transitionId", rs.getLong("transition_id"));
                    m.put("workflowId", workflowId.toString());
                    m.put("workflowName", lookupWorkflowName(workflowId));
                    m.put("runId", rs.getObject("run_id").toString());
                    m.put("businessKey", rs.getString("business_key"));
                    m.put("stepId", stepId.toString());
                    m.put("stepName", lookupStepName(workflowId, stepId));
                    m.put("fromState", rs.getString("from_state"));
                    m.put("toState", rs.getString("to_state"));
                    m.put("transitionedAt",
                        rs.getTimestamp("transitioned_at").toInstant().toString());
                    m.put("actorDeviceId", deviceId == null ? null : deviceId.toString());
                    m.put("actorDeviceName", deviceId == null ? null
                        : devices.findById(deviceId).map((d) -> d.displayName()).orElse(null));
                    return m;
                }, safe);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("rows", rows);
        return ResponseEntity.ok(body);
    }

    /** Steps currently in BLOCKED state + which predecessor is blocking,
     *  derived by taking the most recent transition per (run, step) and
     *  keeping those whose latest to_state = 'BLOCKED'. */
    @GetMapping("/blockages")
    public ResponseEntity<Map<String, Object>> blockages(final Authentication auth) {
        requireAdmin(auth);
        final List<Map<String, Object>> rows = jdbc.query(
                "WITH latest AS ("
              + "  SELECT DISTINCT ON (run_id, step_id) "
              + "         transition_id, workflow_id, run_id, step_id, to_state, "
              + "         transitioned_at "
              + "    FROM der.capture_workflow_step_transition "
              + "   ORDER BY run_id, step_id, transitioned_at DESC, transition_id DESC) "
              + "SELECT l.workflow_id, l.run_id, l.step_id, l.transitioned_at, "
              + "       r.business_key "
              + "  FROM latest l "
              + "  JOIN der.capture_workflow_run r ON r.run_id = l.run_id "
              + " WHERE l.to_state = 'BLOCKED' "
              + " ORDER BY l.transitioned_at ASC",
                (rs, i) -> {
                    final UUID workflowId = (UUID) rs.getObject("workflow_id");
                    final UUID stepId = (UUID) rs.getObject("step_id");
                    final UUID runId = (UUID) rs.getObject("run_id");
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("workflowId", workflowId.toString());
                    m.put("workflowName", lookupWorkflowName(workflowId));
                    m.put("runId", runId.toString());
                    m.put("businessKey", rs.getString("business_key"));
                    m.put("stepId", stepId.toString());
                    m.put("stepName", lookupStepName(workflowId, stepId));
                    m.put("blockedSince",
                        rs.getTimestamp("transitioned_at").toInstant().toString());
                    // Blocking predecessor = the unfinished COMPLETES_BEFORE
                    // predecessor of this step.
                    final List<Map<String, Object>> blockers = blockingPredecessors(workflowId, runId, stepId);
                    m.put("blockedBy", blockers);
                    return m;
                });
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("rows", rows);
        return ResponseEntity.ok(body);
    }

    /** Open validation issues across runs. */
    @GetMapping("/issues")
    public ResponseEntity<Map<String, Object>> issues(final Authentication auth,
            @RequestParam(name = "limit", defaultValue = "200") final int limit) {
        requireAdmin(auth);
        final int safe = Math.max(1, Math.min(limit, 1000));
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT v.issue_id, v.run_id, v.step_id, v.code, v.severity, "
              + "       v.message, v.field_ref, v.detected_at, "
              + "       r.workflow_id, r.business_key "
              + "  FROM der.workflow_validation_issue v "
              + "  JOIN der.capture_workflow_run r ON r.run_id = v.run_id "
              + " WHERE r.state IN ('OPEN','AWAITING') "
              + " ORDER BY v.severity DESC, v.detected_at DESC "
              + " LIMIT ?",
                (rs, i) -> {
                    final UUID workflowId = (UUID) rs.getObject("workflow_id");
                    final UUID stepId = (UUID) rs.getObject("step_id");
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("issueId", rs.getObject("issue_id").toString());
                    m.put("workflowId", workflowId.toString());
                    m.put("workflowName", lookupWorkflowName(workflowId));
                    m.put("runId", rs.getObject("run_id").toString());
                    m.put("businessKey", rs.getString("business_key"));
                    m.put("stepId", stepId == null ? null : stepId.toString());
                    m.put("stepName", stepId == null ? null
                        : lookupStepName(workflowId, stepId));
                    m.put("code", rs.getString("code"));
                    m.put("severity", rs.getString("severity"));
                    m.put("message", rs.getString("message"));
                    m.put("fieldRef", rs.getString("field_ref"));
                    m.put("detectedAt",
                        rs.getTimestamp("detected_at").toInstant().toString());
                    return m;
                }, safe);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("rows", rows);
        return ResponseEntity.ok(body);
    }

    /** Open conflicts (status = PENDING_REVIEW) across runs. */
    @GetMapping("/conflicts")
    public ResponseEntity<Map<String, Object>> conflicts(final Authentication auth,
            @RequestParam(name = "limit", defaultValue = "200") final int limit) {
        requireAdmin(auth);
        final int safe = Math.max(1, Math.min(limit, 1000));
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT c.conflict_id, c.run_id, c.category, c.identity_key, "
              + "       c.detected_at, r.workflow_id, r.business_key "
              + "  FROM der.workflow_conflict c "
              + "  JOIN der.capture_workflow_run r ON r.run_id = c.run_id "
              + " WHERE c.status = 'PENDING_REVIEW' "
              + " ORDER BY c.detected_at DESC "
              + " LIMIT ?",
                (rs, i) -> {
                    final UUID workflowId = (UUID) rs.getObject("workflow_id");
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("conflictId", rs.getObject("conflict_id").toString());
                    m.put("workflowId", workflowId.toString());
                    m.put("workflowName", lookupWorkflowName(workflowId));
                    m.put("runId", rs.getObject("run_id").toString());
                    m.put("businessKey", rs.getString("business_key"));
                    m.put("category", rs.getString("category"));
                    m.put("identityKey", rs.getString("identity_key"));
                    m.put("detectedAt",
                        rs.getTimestamp("detected_at").toInstant().toString());
                    return m;
                }, safe);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("rows", rows);
        return ResponseEntity.ok(body);
    }

    /** One-shot summary used by the Monitoring dashboard header card. */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary(final Authentication auth) {
        requireAdmin(auth);
        final Instant since24 = Instant.now().minus(Duration.ofHours(24));
        final Integer completed24 = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.capture_workflow_step_transition "
                + " WHERE to_state = 'COMPLETE' AND transitioned_at >= ?",
                Integer.class, Timestamp.from(since24));
        final Integer blockedNow = jdbc.queryForObject(
                "WITH latest AS ("
              + "  SELECT DISTINCT ON (run_id, step_id) to_state "
              + "    FROM der.capture_workflow_step_transition "
              + "   ORDER BY run_id, step_id, transitioned_at DESC, transition_id DESC) "
              + "SELECT COUNT(*) FROM latest WHERE to_state = 'BLOCKED'",
                Integer.class);
        final Integer openIssues = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.workflow_validation_issue v "
              + "  JOIN der.capture_workflow_run r ON r.run_id = v.run_id "
              + " WHERE r.state IN ('OPEN','AWAITING') AND v.severity = 'ERROR'",
                Integer.class);
        final Integer openConflicts = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.workflow_conflict "
              + " WHERE status = 'PENDING_REVIEW'",
                Integer.class);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("completedLast24h", nz(completed24));
        body.put("currentlyBlocked", nz(blockedNow));
        body.put("openErrorIssues", nz(openIssues));
        body.put("openConflicts", nz(openConflicts));
        return ResponseEntity.ok(body);
    }

    /* ───── helpers ───── */

    private List<Map<String, Object>> blockingPredecessors(final UUID workflowId,
                                                             final UUID runId,
                                                             final UUID stepId) {
        final Optional<CaptureWorkflow> w = workflows.get(workflowId);
        if (w.isEmpty()) {
            return List.of();
        }
        return w.get().dependencies().stream()
                .filter((d) -> d.stepId().equals(stepId)
                    && d.kind() == ug.ac.mak.der.workflow.CaptureWorkflowDependency.Kind.COMPLETES_BEFORE)
                .map((d) -> d.dependsOnStepId())
                .filter((predId) -> !isCompleted(runId, predId))
                .map((predId) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("stepId", predId.toString());
                    m.put("stepName", lookupStepName(workflowId, predId));
                    return m;
                })
                .toList();
    }

    private boolean isCompleted(final UUID runId, final UUID stepId) {
        final Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.capture_workflow_contribution "
              + " WHERE run_id = ? AND step_id = ?",
                Integer.class, runId, stepId);
        return n != null && n > 0;
    }

    private String lookupWorkflowName(final UUID workflowId) {
        return workflows.get(workflowId).map(CaptureWorkflow::displayName).orElse(null);
    }

    private String lookupStepName(final UUID workflowId, final UUID stepId) {
        return workflows.get(workflowId)
                .flatMap((w) -> w.steps().stream()
                    .filter((s) -> s.stepId().equals(stepId))
                    .findFirst())
                .map(CaptureWorkflowStep::displayName)
                .orElse(null);
    }

    private static int nz(final Integer n) {
        return n == null ? 0 : n;
    }

    private static void requireAdmin(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "not authenticated");
        }
    }
}
