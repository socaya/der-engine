package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.annotation.JsonProperty;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.CaptureFormService;
import ug.ac.mak.der.workflow.CaptureFormService.CaptureFormError;
import ug.ac.mak.der.workflow.CaptureFormService.ErrorCode;
import ug.ac.mak.der.workflow.CaptureFormService.FormAssembly;
import ug.ac.mak.der.workflow.CaptureFormService.FormDataPrefill;
import ug.ac.mak.der.workflow.CaptureWorkflowRun;
import ug.ac.mak.der.workflow.CaptureWorkflowService;

/**
 * ADR-0036 phase 1 — Data-module capture form API.
 *
 * <p>Read-only in phase 1; writes still land on the ADR-0004
 * {@code /api/*} emulator path. The {@code POST /runs} and
 * {@code POST /runs/{id}/advance} endpoints are run-state
 * mutations only, not capture payloads.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/capture",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class CaptureFormController {

    private final CaptureFormService forms;
    private final CaptureWorkflowService workflows;

    public CaptureFormController(final CaptureFormService forms,
                                   final CaptureWorkflowService workflows) {
        this.forms = Objects.requireNonNull(forms, "forms");
        this.workflows = Objects.requireNonNull(workflows, "workflows");
    }

    // ────────────────────────────────────────────────────────────────────
    // Run-scoped endpoints (ADR-0036 D-CAP-2 — primary path)
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/runs")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<Map<String, Object>> listRuns(
            @RequestParam(value = "workflowId", required = false) final UUID workflowId,
            @RequestParam(value = "state", required = false) final String stateFilter) {
        /* Phase 1 scope: only the workflowId filter is meaningful —
         * startRun idempotently returns the same run for a given key
         * so there is no cross-workflow listing use case yet. */
        if (workflowId == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", ErrorCode.CAPTURE_PARAM_INVALID.name(),
                    "message", "workflowId is required in phase 1"));
        }
        List<CaptureWorkflowRun> runs = workflows.runs(workflowId);
        if (stateFilter != null && !stateFilter.isBlank()) {
            final CaptureWorkflowRun.State wanted;
            try {
                wanted = CaptureWorkflowRun.State.valueOf(stateFilter);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", ErrorCode.CAPTURE_PARAM_INVALID.name(),
                        "message", "state must be one of "
                                + java.util.Arrays.toString(
                                        CaptureWorkflowRun.State.values())));
            }
            runs = runs.stream().filter(r -> r.state() == wanted).toList();
        }
        return ResponseEntity.ok(Map.of(
                "count", runs.size(),
                "runs", runs.stream()
                        .map(CaptureFormController::runSummary).toList()));
    }

    @PostMapping(path = "/runs", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<Map<String, Object>> startRun(
            final Authentication authentication,
            @RequestBody final StartRunRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.workflowId() == null || body.businessKey() == null
                || body.businessKey().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", ErrorCode.CAPTURE_PARAM_INVALID.name(),
                    "message", "workflowId + businessKey are required"));
        }
        try {
            final CaptureWorkflowRun run = workflows.startRun(
                    body.workflowId(), body.businessKey(), principal.userId());
            return ResponseEntity.status(201).body(runSummary(run));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", ErrorCode.CAPTURE_PARAM_INVALID.name(),
                    "message", ex.getMessage() == null
                            ? "invalid request" : ex.getMessage()));
        }
    }

    @GetMapping("/runs/{runId}")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<Map<String, Object>> getRun(
            @PathVariable("runId") final UUID runId) {
        final Optional<CaptureWorkflowRun> run = forms.findRun(runId);
        if (run.isEmpty()) {
            return notFound("run " + runId + " not found");
        }
        return ResponseEntity.ok(runSummary(run.get()));
    }

    @GetMapping("/runs/{runId}/form")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<?> getRunForm(
            final Authentication authentication,
            @PathVariable("runId") final UUID runId,
            @RequestHeader(value = "X-DER-Device-Id", required = false)
            final String deviceHeader) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final UUID deviceId = parseDeviceHeader(deviceHeader);
        if (deviceHeader != null && !deviceHeader.isBlank() && deviceId == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", ErrorCode.CAPTURE_PARAM_INVALID.name(),
                    "message", "X-DER-Device-Id must be a UUID"));
        }
        try {
            final FormAssembly form = forms.assembleForRun(runId,
                    primaryRole(principal), deviceId);
            return ResponseEntity.ok(form);
        } catch (CaptureFormError ex) {
            return errorResponse(ex);
        }
    }

    @GetMapping("/runs/{runId}/data")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<?> getRunData(@PathVariable("runId") final UUID runId) {
        try {
            final FormDataPrefill prefill = forms.prefetchRunData(runId);
            return ResponseEntity.ok(prefill);
        } catch (CaptureFormError ex) {
            return errorResponse(ex);
        }
    }

    @PostMapping("/runs/{runId}/advance")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<Map<String, Object>> advance(
            final Authentication authentication,
            @PathVariable("runId") final UUID runId) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (forms.findRun(runId).isEmpty()) {
            return notFound("run " + runId + " not found");
        }
        final boolean completed = workflows.advanceRunState(runId);
        /* Reload so the response reflects the state transition made
         * by advanceRunState (if any). advanceRunState is idempotent —
         * a run already at COMPLETED stays COMPLETED. */
        final CaptureWorkflowRun after = forms.findRun(runId)
                .orElseThrow(() -> new IllegalStateException(
                        "run disappeared after advance"));
        final Map<String, Object> body = new LinkedHashMap<>();
        body.putAll(runSummary(after));
        body.put("completedByThisCall", completed);
        return ResponseEntity.ok(body);
    }

    // ────────────────────────────────────────────────────────────────────
    // Free-standing endpoints (D-CAP-4 fallback)
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/datasets/{dataSetUid}/form")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<?> getDataSetForm(
            @PathVariable("dataSetUid") final String dataSetUid) {
        try {
            return ResponseEntity.ok(forms.assembleForDataSet(dataSetUid));
        } catch (CaptureFormError ex) {
            return errorResponse(ex);
        }
    }

    @GetMapping("/datasets/{dataSetUid}/data")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<?> getDataSetData(
            @PathVariable("dataSetUid") final String dataSetUid,
            @RequestParam(value = "orgUnit", required = false) final String orgUnit,
            @RequestParam(value = "period", required = false) final String period) {
        /* dataSetUid is in the path for symmetry with /form, but
         * aggregate_data_value is keyed on (orgUnit, period, dataElement, coc) —
         * the dataSetUid is advisory metadata on each row.  The prefetch
         * query is scoped by orgUnit + period for the compound key. */
        try {
            return ResponseEntity.ok(forms.prefetchDataSetData(orgUnit, period));
        } catch (CaptureFormError ex) {
            return errorResponse(ex);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Program-stage + event endpoints (ADR-0036 phase 2)
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/programs/{programUid}/stages")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<?> listStages(
            @PathVariable("programUid") final String programUid) {
        try {
            final var stages = forms.listStagesForProgram(programUid);
            return ResponseEntity.ok(Map.of(
                    "count", stages.size(),
                    "stages", stages));
        } catch (CaptureFormError ex) {
            return errorResponse(ex);
        }
    }

    @GetMapping("/programs/{programUid}/stages/{stageUid}/form")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<?> getStageForm(
            @PathVariable("programUid") final String programUid,
            @PathVariable("stageUid") final String stageUid) {
        try {
            return ResponseEntity.ok(forms.assembleForProgramStage(programUid, stageUid));
        } catch (CaptureFormError ex) {
            return errorResponse(ex);
        }
    }

    @GetMapping("/programs/{programUid}/events")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<?> listEvents(
            @PathVariable("programUid") final String programUid,
            @RequestParam(value = "orgUnit", required = false) final String orgUnit,
            @RequestParam(value = "limit", defaultValue = "100") final int limit) {
        try {
            final var rows = forms.listEvents(programUid, orgUnit, limit);
            return ResponseEntity.ok(Map.of(
                    "count", rows.size(),
                    "events", rows));
        } catch (CaptureFormError ex) {
            return errorResponse(ex);
        }
    }

    @GetMapping("/events/{eventUid}/detail")
    @PreAuthorize("hasAuthority('der.capture.read')")
    public ResponseEntity<?> getEventDetail(
            @PathVariable("eventUid") final UUID eventUid) {
        try {
            return ResponseEntity.ok(forms.getEventDetail(eventUid));
        } catch (CaptureFormError ex) {
            return errorResponse(ex);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────

    private static Map<String, Object> runSummary(final CaptureWorkflowRun r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("runId", r.runId().toString());
        m.put("workflowId", r.workflowId().toString());
        m.put("workflowVersion", r.workflowVersion());
        m.put("businessKey", r.businessKey());
        m.put("currentStepId", r.currentStepId() == null
                ? null : r.currentStepId().toString());
        m.put("state", r.state().name());
        m.put("createdAt", r.createdAt().toString());
        m.put("updatedAt", r.updatedAt().toString());
        return m;
    }

    private static UUID parseDeviceHeader(final String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    /** The highest-ranked role the principal holds — used for the
     *  ownership check in assembleForRun. */
    private static String primaryRole(final EdgeUserPrincipal principal) {
        final var roles = principal.user().roles();
        for (final EdgeRole role : List.of(EdgeRole.ADMIN, EdgeRole.REVIEWER,
                EdgeRole.OPERATOR, EdgeRole.SYNC_WORKER)) {
            if (roles.contains(role)) {
                return role.name();
            }
        }
        return "UNKNOWN";
    }

    private static ResponseEntity<Map<String, Object>> notFound(final String msg) {
        return ResponseEntity.status(404).body(Map.of(
                "code", ErrorCode.WORKFLOW_RUN_NOT_FOUND.name(),
                "message", msg));
    }

    private static ResponseEntity<Map<String, Object>> errorResponse(final CaptureFormError ex) {
        final int http = httpFor(ex.code());
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", ex.code().name());
        body.put("message", ex.getMessage() == null
                ? ex.code().name() : ex.getMessage());
        body.putAll(ex.detail());
        return ResponseEntity.status(http).body(body);
    }

    private static int httpFor(final ErrorCode code) {
        return switch (code) {
            case CAPTURE_PARAM_INVALID -> 400;
            case WORKFLOW_RUN_NOT_FOUND -> 404;
            case WORKFLOW_RUN_BLOCKED -> 409;
            case WORKFLOW_RUN_NOT_OWNED, DEVICE_HEADER_REQUIRED -> 403;
            case METADATA_NOT_READY -> 503;
        };
    }

    public record StartRunRequest(
            @JsonProperty("workflowId") UUID workflowId,
            @JsonProperty("businessKey") String businessKey
    ) { }
}
