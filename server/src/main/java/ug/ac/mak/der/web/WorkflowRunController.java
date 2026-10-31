package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.CaptureWorkflowRun;
import ug.ac.mak.der.workflow.CaptureWorkflowService;
import ug.ac.mak.der.workflow.ConflictDetector;
import ug.ac.mak.der.workflow.ProgressiveValidator;
import ug.ac.mak.der.workflow.WorkflowRunCoordinator;

/** §2.3.11 — workflow run API (spec §69).
 *
 *  <ul>
 *    <li>{@code POST /workflows/{id}/runs}</li>
 *    <li>{@code POST /workflows/runs/{runId}/steps/{stepId}/contribute}</li>
 *    <li>{@code POST /workflows/runs/{runId}/reject}</li>
 *    <li>{@code GET  /workflows/runs/{runId}}</li>
 *    <li>{@code GET  /workflows/runs/{runId}/canonical}</li>
 *    <li>{@code GET  /workflows/runs/{runId}/readiness}</li>
 *  </ul>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/workflows",
                produces = MediaType.APPLICATION_JSON_VALUE)
public class WorkflowRunController {

    private final WorkflowRunCoordinator coord;
    private final CaptureWorkflowService workflows;
    private final ConflictDetector conflicts;
    private final ProgressiveValidator validator;

    public WorkflowRunController(final WorkflowRunCoordinator coord,
                                   final CaptureWorkflowService workflows,
                                   final ConflictDetector conflicts,
                                   final ProgressiveValidator validator) {
        this.coord = Objects.requireNonNull(coord, "coord");
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.conflicts = Objects.requireNonNull(conflicts, "conflicts");
        this.validator = Objects.requireNonNull(validator, "validator");
    }

    @PostMapping(path = "/{workflowId}/runs",
                 consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> openRun(
            final Authentication auth,
            @PathVariable("workflowId") final UUID workflowId,
            @RequestBody final OpenRequest body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.businessKey() == null || body.businessKey().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "BUSINESS_KEY_REQUIRED",
                "message", "businessKey is required"));
        }
        try {
            final CaptureWorkflowRun run = coord.openRun(workflowId, body.businessKey(),
                    principal.userId());
            return ResponseEntity.ok(runJson(run));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of(
                "code", "WORKFLOW_NOT_FOUND", "message", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(Map.of(
                "code", "WORKFLOW_DISABLED", "message", ex.getMessage()));
        }
    }

    @PostMapping(path = "/runs/{runId}/steps/{stepId}/contribute",
                 consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> contribute(
            final Authentication auth,
            @PathVariable("runId") final UUID runId,
            @PathVariable("stepId") final UUID stepId,
            @RequestBody final ContributeRequest body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.payload() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "PAYLOAD_REQUIRED",
                "message", "payload is required"));
        }
        try {
            final WorkflowRunCoordinator.ContributionResult res = coord.contribute(
                runId, stepId, body.payload(),
                principal.userId(), body.deviceId());
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("run", runJson(res.run()));
            m.put("completed", res.completed());
            m.put("readiness", readinessJson(res.readiness()));
            return ResponseEntity.ok(m);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "INVALID_REQUEST", "message", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(Map.of(
                "code", "STEP_BLOCKED", "message", ex.getMessage()));
        }
    }

    @PostMapping(path = "/runs/{runId}/reject",
                 consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> reject(
            final Authentication auth,
            @PathVariable("runId") final UUID runId,
            @RequestBody final RejectRequest body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.reason() == null || body.reason().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "REJECTION_REASON_REQUIRED",
                "message", "a reason is required when rejecting a run"));
        }
        try {
            final CaptureWorkflowRun run = coord.markRejected(runId,
                body.reason().trim(), principal.userId());
            return ResponseEntity.ok(runJson(run));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/runs/{runId}")
    public ResponseEntity<Map<String, Object>> getRun(
            @PathVariable("runId") final UUID runId) {
        return workflows.findRunById(runId)
            .<ResponseEntity<Map<String, Object>>>map(r -> ResponseEntity.ok(runJson(r)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/runs/{runId}/canonical")
    public ResponseEntity<Map<String, Object>> canonical(
            @PathVariable("runId") final UUID runId) {
        return ResponseEntity.ok(coord.readCanonicalState(runId));
    }

    /** Progressive-validation findings for a run (spec §36). */
    @GetMapping("/runs/{runId}/validation")
    public ResponseEntity<Map<String, Object>> validation(
            @PathVariable("runId") final UUID runId) {
        final List<ProgressiveValidator.Issue> issues = validator.findForRun(runId);
        final List<Map<String, Object>> rows = new java.util.ArrayList<>();
        for (final ProgressiveValidator.Issue i : issues) {
            final Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("issueId", i.issueId().toString());
            m.put("runId", i.runId().toString());
            m.put("stepId", i.stepId() == null ? null : i.stepId().toString());
            m.put("code", i.code());
            m.put("severity", i.severity().name());
            m.put("message", i.message());
            m.put("fieldRef", i.fieldRef());
            rows.add(m);
        }
        final long errors = issues.stream()
                .filter((i) -> i.severity() == ProgressiveValidator.Severity.ERROR)
                .count();
        return ResponseEntity.ok(Map.of(
            "runId", runId.toString(),
            "errorCount", errors,
            "issues", rows));
    }

    @GetMapping("/runs/{runId}/readiness")
    public ResponseEntity<Map<String, Object>> readiness(
            @PathVariable("runId") final UUID runId) {
        final var run = workflows.findRunById(runId);
        if (run.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final var workflow = workflows.get(run.get().workflowId());
        if (workflow.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final var all = workflows.contributionsForRun(runId);
        final var readiness = coord.computeReadiness(workflow.get(), all);
        return ResponseEntity.ok(Map.of("readiness", readinessJson(readiness)));
    }

    /* ─── §2.3.12 conflict API ──────────────────────────────────── */

    @GetMapping("/runs/{runId}/conflicts")
    public ResponseEntity<Map<String, Object>> listConflicts(
            @PathVariable("runId") final UUID runId) {
        final List<Map<String, Object>> rows = conflicts.list(runId);
        return ResponseEntity.ok(Map.of(
            "runId", runId.toString(),
            "pending", rows.stream().filter((m) -> "PENDING_REVIEW".equals(m.get("status"))).count(),
            "conflicts", rows));
    }

    @PostMapping(path = "/runs/{runId}/conflicts/{conflictId}/resolve",
                 consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> resolveConflict(
            final Authentication auth,
            @PathVariable("runId") final UUID runId,
            @PathVariable("conflictId") final UUID conflictId,
            @RequestBody final ResolveRequest body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.strategy() == null || body.strategy().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "STRATEGY_REQUIRED",
                "message", "resolution strategy required (LATEST_WINS / EARLIEST_WINS / MANUAL / DISMISSED)"));
        }
        final int rows = conflicts.resolve(conflictId, body.strategy().toUpperCase(),
            body.value(), principal.userId());
        if (rows == 0) {
            return ResponseEntity.status(409).body(Map.of(
                "code", "CONFLICT_NOT_PENDING",
                "message", "conflict already resolved or does not exist"));
        }
        final boolean completed = coord.tryComplete(runId);
        return ResponseEntity.ok(Map.of(
            "conflictId", conflictId.toString(),
            "resolved", true,
            "runCompleted", completed));
    }

    /* ─── helpers ────────────────────────────────────────────────── */

    private static Map<String, Object> runJson(final CaptureWorkflowRun r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("runId", r.runId().toString());
        m.put("workflowId", r.workflowId().toString());
        m.put("workflowVersion", r.workflowVersion());
        m.put("businessKey", r.businessKey());
        m.put("state", r.state().name());
        m.put("createdAt", r.createdAt().toString());
        m.put("updatedAt", r.updatedAt().toString());
        m.put("submissionJournalOpId",
            r.submissionJournalOpId() == null ? null : r.submissionJournalOpId().toString());
        m.put("submissionError", r.submissionError());
        return m;
    }

    private static Map<String, String> readinessJson(
            final Map<UUID, WorkflowRunCoordinator.Readiness> readiness) {
        final Map<String, String> m = new LinkedHashMap<>();
        readiness.forEach((k, v) -> m.put(k.toString(), v.name()));
        return m;
    }

    /* ─── request bodies ─────────────────────────────────────────── */

    public record OpenRequest(@JsonProperty("businessKey") String businessKey) { }

    public record ContributeRequest(
            @JsonProperty("payload") String payload,
            @JsonProperty("deviceId") UUID deviceId) { }

    public record RejectRequest(@JsonProperty("reason") String reason) { }

    public record ResolveRequest(
            @JsonProperty("strategy") String strategy,
            @JsonProperty("value") JsonNode value) { }
}
