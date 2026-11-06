package ug.ac.mak.der.workflow;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MetadataMirrorRepository;
import ug.ac.mak.der.metadata.MirroredCategoryOptionCombo;
import ug.ac.mak.der.metadata.MirroredDataElement;
import ug.ac.mak.der.metadata.MirroredDataSet;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValue;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;

/**
 * ADR-0036 — projects a {@link CaptureWorkflowRun}'s current step onto a
 * flat, client-renderable form envelope. The envelope shape matches
 * D-CAP-3 and is identical across run-scoped and free-standing fetches.
 *
 * <p>Pure read-side. Writes still go through the ADR-0004 {@code /api/*}
 * emulator endpoints; this service never mutates state.</p>
 */
@Service
public class CaptureFormService {

    /** DHIS2's default category option combo — seeded by V005 on every
     *  mirror. Used when a dataset's data element has no explicit COC
     *  scoping, which is the common aggregate case. */
    public static final String DEFAULT_CATEGORY_OPTION_COMBO = "HllvX50cXC0";

    /** fieldRef shape in ADR-0018 is "<de>|<coc>". */
    private static final String FIELD_SEP = "|";

    private final CaptureWorkflowService workflows;
    private final CaptureWorkflowRepository workflowRepo;
    private final CaptureWorkflowContributionRepository contributions;
    private final MetadataMirrorRepository mirror;
    private final ExtendedMirrorRepository extended;
    private final AggregateDataValueRepository aggregates;

    public CaptureFormService(final CaptureWorkflowService workflows,
                               final CaptureWorkflowRepository workflowRepo,
                               final CaptureWorkflowContributionRepository contributions,
                               final MetadataMirrorRepository mirror,
                               final ExtendedMirrorRepository extended,
                               final AggregateDataValueRepository aggregates) {
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.workflowRepo = Objects.requireNonNull(workflowRepo, "workflowRepo");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
        this.mirror = Objects.requireNonNull(mirror, "mirror");
        this.extended = Objects.requireNonNull(extended, "extended");
        this.aggregates = Objects.requireNonNull(aggregates, "aggregates");
    }

    // ────────────────────────────────────────────────────────────────────
    // Run-scoped form assembly (ADR-0036 D-CAP-2 / D-CAP-3 primary path)
    // ────────────────────────────────────────────────────────────────────

    /**
     * Assemble the form envelope for a workflow run's current step.
     *
     * @param runId              the workflow run
     * @param actorRole          requesting principal's role name
     *                           (ADMIN/OPERATOR/REVIEWER/SYNC_WORKER)
     * @param clientDeviceHeader value of X-DER-Device-Id ({@code null} if
     *                           absent)
     */
    public FormAssembly assembleForRun(final UUID runId,
                                        final String actorRole,
                                        final UUID clientDeviceHeader) {
        final CaptureWorkflowRun run = workflowRepo.findRun(runId)
                .orElseThrow(() -> new CaptureFormError(
                        ErrorCode.WORKFLOW_RUN_NOT_FOUND,
                        "run " + runId + " not found"));
        final CaptureWorkflow wf = workflows.get(run.workflowId())
                .orElseThrow(() -> new CaptureFormError(
                        ErrorCode.WORKFLOW_RUN_NOT_FOUND,
                        "workflow " + run.workflowId() + " not found"));

        final CaptureWorkflowStep current = wf.steps().stream()
                .filter(s -> s.stepId().equals(run.currentStepId()))
                .findFirst()
                .orElseThrow(() -> new CaptureFormError(
                        ErrorCode.WORKFLOW_RUN_NOT_FOUND,
                        "current step " + run.currentStepId() + " not on workflow"));

        /* Blocked-on-dependency check: every COMPLETES_BEFORE dep of
         * the current step must have at least one contribution for
         * this run.  If any are unsatisfied, 409 with the blocking
         * stepIds listed so the client can render the wait context
         * without a second round-trip. */
        final Map<UUID, Set<UUID>> completedByStep = contributionsByStep(runId);
        final Set<UUID> blockedBy = unmetDependencies(wf, current, completedByStep);
        if (!blockedBy.isEmpty()) {
            throw new CaptureFormError(ErrorCode.WORKFLOW_RUN_BLOCKED,
                    "step " + current.stepId() + " waits on "
                            + blockedBy.size() + " upstream step"
                            + (blockedBy.size() == 1 ? "" : "s"),
                    Map.of("blockedOnStepIds", blockedBy.stream()
                            .map(UUID::toString).toList()));
        }

        /* Phase 1 constraint: only DATA_SET binding is supported.
         * PROGRAM / PROGRAM_STAGE / *_SECTION land with ADR-0018 slice B. */
        if (wf.boundMetadataKind() != CaptureWorkflow.BindingKind.DATA_SET) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "binding kind " + wf.boundMetadataKind()
                            + " not supported in phase 1");
        }

        final MirroredDataSet dataSet = mirror.findDataSet(wf.boundMetadataId())
                .orElseThrow(() -> new CaptureFormError(
                        ErrorCode.METADATA_NOT_READY,
                        "dataSet " + wf.boundMetadataId() + " not mirrored"));

        final Ownership ownership = resolveOwnership(current, actorRole,
                clientDeviceHeader);

        /* Build the editable sections from this step's fields. */
        final List<FormField> editable = projectFields(current.fields());

        /* Upstream context: any prior step with at least one
         * contribution (treated as COMPLETED in slice A — the worker
         * drains runs step-by-step in ADR-0018 D14) groups its fields
         * into a read-only context block so the current actor sees
         * what came before. */
        final List<UpstreamStepContext> upstream = new ArrayList<>();
        for (final CaptureWorkflowStep step : wf.steps()) {
            if (step.stepId().equals(current.stepId())) {
                continue;
            }
            if (!completedByStep.getOrDefault(step.stepId(), Set.of()).isEmpty()) {
                upstream.add(new UpstreamStepContext(
                        step.stepId(),
                        step.displayName(),
                        projectFields(step.fields())));
            }
        }

        return new FormAssembly(
                FormType.AGGREGATE,
                wf.boundMetadataKind().name(),
                wf.boundMetadataId(),
                dataSet.displayName(),
                ownership,
                List.of(new FormSection(null, current.displayName(), editable)),
                upstream);
    }

    /**
     * Prefetch existing aggregate values for a run, keyed as
     * {@code "<de>|<coc>"} so the client can hydrate the form.
     *
     * <p>The run's business key encodes {@code "orgUnit|period"} for
     * DATA_SET bindings (ADR-0018 schema).</p>
     */
    public FormDataPrefill prefetchRunData(final UUID runId) {
        final CaptureWorkflowRun run = workflowRepo.findRun(runId)
                .orElseThrow(() -> new CaptureFormError(
                        ErrorCode.WORKFLOW_RUN_NOT_FOUND,
                        "run " + runId + " not found"));
        final String[] parts = run.businessKey().split("\\|", 2);
        if (parts.length != 2) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "businessKey must be 'orgUnit|period' for DATA_SET runs");
        }
        return prefetchDataSetData(parts[0], parts[1]);
    }

    // ────────────────────────────────────────────────────────────────────
    // Free-standing form assembly (D-CAP-4 fallback)
    // ────────────────────────────────────────────────────────────────────

    /**
     * Free-standing aggregate form — no workflow run. Returns every
     * dataElement × categoryOptionCombo cell declared by the dataSet
     * with {@code OPTIONAL} requirement. Ownership is always
     * {@code isMyStep=true} (no workflow gate).
     */
    public FormAssembly assembleForDataSet(final String dataSetUid) {
        final MirroredDataSet dataSet = mirror.findDataSet(dataSetUid)
                .orElseThrow(() -> new CaptureFormError(
                        ErrorCode.METADATA_NOT_READY,
                        "dataSet " + dataSetUid + " not mirrored"));
        final List<String> dataElementUids = extractDataElementUids(dataSet);
        if (dataElementUids.isEmpty()) {
            throw new CaptureFormError(ErrorCode.METADATA_NOT_READY,
                    "dataSet " + dataSetUid + " has no dataSetElements mirrored");
        }
        final List<FormField> fields = new ArrayList<>();
        for (final String deUid : dataElementUids) {
            final MirroredDataElement de = mirror.findDataElement(deUid)
                    .orElse(null);
            if (de == null) {
                continue;
            }
            /* Phase 1: default COC only.  A later phase will walk
             * dataElement.categoryCombo → list of COCs for
             * disaggregated forms. */
            final MirroredCategoryOptionCombo coc = extended
                    .findCategoryOptionCombo(DEFAULT_CATEGORY_OPTION_COMBO)
                    .orElse(null);
            fields.add(new FormField(
                    fieldRef(deUid, DEFAULT_CATEGORY_OPTION_COMBO),
                    deUid,
                    DEFAULT_CATEGORY_OPTION_COMBO,
                    de.displayName(),
                    coc == null ? null : coc.displayName(),
                    de.valueType(),
                    readOptionSetUid(de),
                    Requirement.OPTIONAL));
        }
        return new FormAssembly(
                FormType.AGGREGATE,
                CaptureWorkflow.BindingKind.DATA_SET.name(),
                dataSetUid,
                dataSet.displayName(),
                new Ownership(null, null, true),
                List.of(new FormSection(null, dataSet.displayName(), fields)),
                List.of());
    }

    /**
     * Free-standing aggregate data prefetch. Reads
     * {@code aggregate_data_value} by {@code (orgUnit, period)} and
     * returns a {@code "<de>|<coc>" → value} map.
     */
    public FormDataPrefill prefetchDataSetData(final String orgUnitUid,
                                                 final String periodIso) {
        if (orgUnitUid == null || orgUnitUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "orgUnit is required");
        }
        if (periodIso == null || periodIso.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "period is required");
        }
        final List<AggregateDataValue> rows = aggregates
                .findByFilter(orgUnitUid, periodIso, 10_000);
        final Map<String, String> cells = new LinkedHashMap<>();
        java.time.Instant lastUpdated = null;
        for (final AggregateDataValue v : rows) {
            cells.put(fieldRef(v.dataElementUid(), v.categoryOptionComboUid()),
                    v.valueText());
            if (lastUpdated == null || v.submittedAt().isAfter(lastUpdated)) {
                lastUpdated = v.submittedAt();
            }
        }
        return new FormDataPrefill(cells, lastUpdated);
    }

    // ────────────────────────────────────────────────────────────────────
    // Internal projection helpers
    // ────────────────────────────────────────────────────────────────────

    private List<FormField> projectFields(final Collection<CaptureWorkflowField> defs) {
        final List<FormField> out = new ArrayList<>();
        for (final CaptureWorkflowField f : defs) {
            if (f.requirement() == CaptureWorkflowField.Requirement.HIDDEN) {
                continue;
            }
            final String[] parts = f.fieldRef().split("\\|", 2);
            final String deUid = parts[0];
            final String cocUid = parts.length == 2 && !parts[1].isBlank()
                    ? parts[1] : DEFAULT_CATEGORY_OPTION_COMBO;
            final MirroredDataElement de = mirror.findDataElement(deUid).orElse(null);
            final MirroredCategoryOptionCombo coc = extended
                    .findCategoryOptionCombo(cocUid).orElse(null);
            if (de == null) {
                /* The field references a dataElement that isn't in the
                 * mirror. Surface as METADATA_NOT_READY at the service
                 * boundary — the worker can re-run sync + retry. */
                throw new CaptureFormError(ErrorCode.METADATA_NOT_READY,
                        "dataElement " + deUid + " referenced by workflow field "
                                + "is not mirrored; run metadata-sync first");
            }
            out.add(new FormField(
                    f.fieldRef(),
                    deUid,
                    cocUid,
                    de.displayName(),
                    coc == null ? null : coc.displayName(),
                    de.valueType(),
                    readOptionSetUid(de),
                    translate(f.requirement())));
        }
        return out;
    }

    private Set<UUID> unmetDependencies(final CaptureWorkflow wf,
                                         final CaptureWorkflowStep step,
                                         final Map<UUID, Set<UUID>> completedByStep) {
        final Set<UUID> unmet = new HashSet<>();
        for (final CaptureWorkflowDependency dep : wf.dependencies()) {
            if (!dep.stepId().equals(step.stepId())) {
                continue;
            }
            final Set<UUID> contribIds = completedByStep.getOrDefault(
                    dep.dependsOnStepId(), Set.of());
            if (contribIds.isEmpty()) {
                unmet.add(dep.dependsOnStepId());
            }
        }
        return unmet;
    }

    private Map<UUID, Set<UUID>> contributionsByStep(final UUID runId) {
        final Map<UUID, Set<UUID>> byStep = new HashMap<>();
        for (final CaptureWorkflowContribution c : contributions.findByRun(runId)) {
            byStep.computeIfAbsent(c.stepId(), id -> new HashSet<>())
                    .add(c.contributionId());
        }
        return byStep;
    }

    private Ownership resolveOwnership(final CaptureWorkflowStep step,
                                        final String actorRole,
                                        final UUID clientDeviceHeader) {
        final String ownerRoleName = step.ownerRole().name();
        final boolean roleOk = ownerRoleName.equalsIgnoreCase(actorRole);
        final UUID deviceGate = step.ownerDeviceId();
        if (deviceGate == null) {
            return new Ownership(ownerRoleName, null, roleOk);
        }
        /* Step requires a specific device. Missing header = can't
         * make the call at all per ADR-0023 symmetric semantics. */
        if (clientDeviceHeader == null) {
            throw new CaptureFormError(ErrorCode.DEVICE_HEADER_REQUIRED,
                    "step " + step.stepId() + " is device-owned; set "
                            + "X-DER-Device-Id header");
        }
        final boolean deviceOk = deviceGate.equals(clientDeviceHeader);
        return new Ownership(ownerRoleName, deviceGate,
                roleOk && deviceOk);
    }

    private static String fieldRef(final String de, final String coc) {
        return de + FIELD_SEP + coc;
    }

    private static Requirement translate(final CaptureWorkflowField.Requirement r) {
        return Requirement.valueOf(r.name());
    }

    /** Read the optionSet UID from a dataElement's JSONB payload if
     *  present. Shape: {@code {"optionSet": {"id": "..."}}}. */
    private static String readOptionSetUid(final MirroredDataElement de) {
        final var opt = de.payload().path("optionSet");
        if (opt.isMissingNode() || opt.isNull()) {
            return null;
        }
        final var id = opt.path("id");
        return id.isMissingNode() || id.isNull() ? null : id.asText();
    }

    /** Extract dataElement UIDs from the dataSet payload. Shape:
     *  {@code {"dataSetElements": [{"dataElement": {"id": "..."}}]}}
     *  or (older DHIS2) {@code {"dataElements": [{"id": "..."}]}}. */
    private static List<String> extractDataElementUids(final MirroredDataSet dataSet) {
        final var payload = dataSet.payload();
        final List<String> out = new ArrayList<>();
        final var dse = payload.path("dataSetElements");
        if (dse.isArray()) {
            dse.forEach(n -> {
                final var id = n.path("dataElement").path("id");
                if (id.isTextual()) {
                    out.add(id.asText());
                }
            });
        }
        if (out.isEmpty()) {
            final var des = payload.path("dataElements");
            if (des.isArray()) {
                des.forEach(n -> {
                    final var id = n.path("id");
                    if (id.isTextual()) {
                        out.add(id.asText());
                    }
                });
            }
        }
        return out.stream().distinct().collect(Collectors.toList());
    }

    // ────────────────────────────────────────────────────────────────────
    // Public types (response envelope — matches ADR-0036 D-CAP-3)
    // ────────────────────────────────────────────────────────────────────

    public enum FormType { AGGREGATE, EVENT_STAGE, TRACKER_STAGE }

    public enum Requirement { REQUIRED, OPTIONAL, READONLY }

    public enum ErrorCode {
        CAPTURE_PARAM_INVALID,
        WORKFLOW_RUN_NOT_FOUND,
        WORKFLOW_RUN_BLOCKED,
        WORKFLOW_RUN_NOT_OWNED,
        METADATA_NOT_READY,
        DEVICE_HEADER_REQUIRED
    }

    public record Ownership(String ownerRole, UUID ownerDeviceId, boolean isMyStep) { }

    public record FormField(
            String fieldRef,
            String dataElementUid,
            String categoryOptionComboUid,
            String dataElementDisplayName,
            String categoryOptionComboDisplayName,
            String valueType,
            String optionSetUid,
            Requirement requirement) { }

    public record FormSection(
            UUID sectionUid,
            String displayName,
            List<FormField> fields) { }

    public record UpstreamStepContext(
            UUID stepId,
            String stepDisplayName,
            List<FormField> fields) { }

    public record FormAssembly(
            FormType formType,
            String bindingKind,
            String bindingUid,
            String displayName,
            Ownership ownership,
            List<FormSection> sections,
            List<UpstreamStepContext> upstreamContext) { }

    public record FormDataPrefill(
            Map<String, String> cells,
            java.time.Instant lastUpdatedAt) { }

    /** Thrown by projection methods; the controller translates to HTTP. */
    public static final class CaptureFormError extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final ErrorCode code;
        private final Map<String, Object> detail;

        public CaptureFormError(final ErrorCode code, final String message) {
            this(code, message, Map.of());
        }

        public CaptureFormError(final ErrorCode code, final String message,
                                  final Map<String, Object> detail) {
            super(message);
            this.code = Objects.requireNonNull(code);
            this.detail = detail == null ? Map.of() : Map.copyOf(detail);
        }

        public ErrorCode code() {
            return code;
        }

        public Map<String, Object> detail() {
            return detail;
        }
    }

    /** Optional accessor used by tests + controller construction. */
    public Optional<CaptureWorkflowRun> findRun(final UUID runId) {
        return workflowRepo.findRun(runId);
    }
}
