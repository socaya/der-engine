package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.ArrayList;
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

/** ADR-0018 slice A capture-workflow REST surface. ADMIN-gated for writes. */
@RestController
@RequestMapping(path = "/edge-api/v1/workflows", produces = MediaType.APPLICATION_JSON_VALUE)
public class CaptureWorkflowController {

    private final CaptureWorkflowService svc;
    private final CaptureWorkflowImportService importer;
    private final CaptureWorkflowContributionRepository contributions;

    public CaptureWorkflowController(final CaptureWorkflowService svc,
                                       final CaptureWorkflowImportService importer,
                                       final CaptureWorkflowContributionRepository contributions) {
        this.svc = Objects.requireNonNull(svc, "svc");
        this.importer = Objects.requireNonNull(importer, "importer");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
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
            @RequestBody final CaptureWorkflowImportService.CanonicalWorkflow body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
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
                    steps.add(new CaptureWorkflowStep(stepId, id, s.ordinal(), s.displayName(),
                            CaptureWorkflowStep.OwnerRole.valueOf(
                                    s.ownerRole().toUpperCase(java.util.Locale.ROOT)),
                            s.ownerDeviceId(),
                            CaptureWorkflowStep.StepKind.valueOf(
                                    s.stepKind().toUpperCase(java.util.Locale.ROOT)),
                            fields));
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
                    Instant.now(), Instant.now(), principal.userId(), steps, deps);
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
        m.put("fields", s.fields().stream().map(f -> Map.of(
                "fieldRef", f.fieldRef(), "requirement", f.requirement().name())).toList());
        return m;
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
            @JsonProperty("dependencies") List<DependencyRequest> dependencies) { }

    public record StepRequest(
            @JsonProperty("stepId") UUID stepId,
            @JsonProperty("ordinal") int ordinal,
            @JsonProperty("displayName") String displayName,
            @JsonProperty("ownerRole") String ownerRole,
            @JsonProperty("ownerDeviceId") UUID ownerDeviceId,
            @JsonProperty("stepKind") String stepKind,
            @JsonProperty("fields") List<FieldRequest> fields) { }

    public record FieldRequest(
            @JsonProperty("fieldRef") String fieldRef,
            @JsonProperty("requirement") String requirement) { }

    public record DependencyRequest(
            @JsonProperty("stepId") UUID stepId,
            @JsonProperty("dependsOnStepId") UUID dependsOnStepId,
            @JsonProperty("kind") String kind) { }
}
