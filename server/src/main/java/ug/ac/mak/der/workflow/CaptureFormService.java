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
import ug.ac.mak.der.metadata.MirroredProgramStageSection;
import ug.ac.mak.der.metadata.MirroredCategoryOptionCombo;
import ug.ac.mak.der.metadata.MirroredDataElement;
import ug.ac.mak.der.metadata.MirroredDataSet;
import ug.ac.mak.der.metadata.MirroredProgram;
import ug.ac.mak.der.metadata.MirroredProgramStage;
import ug.ac.mak.der.metadata.MirroredTrackedEntityAttribute;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValue;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventRepository;
import ug.ac.mak.der.workflows.tracker.Enrollment;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackerEvent;
import ug.ac.mak.der.workflows.tracker.TrackerEventRepository;

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
    private final EventRepository events;
    private final EnrollmentRepository enrollments;
    private final TrackerEventRepository trackerEvents;

    public CaptureFormService(final CaptureWorkflowService workflows,
                               final CaptureWorkflowRepository workflowRepo,
                               final CaptureWorkflowContributionRepository contributions,
                               final MetadataMirrorRepository mirror,
                               final ExtendedMirrorRepository extended,
                               final AggregateDataValueRepository aggregates,
                               final EventRepository events,
                               final EnrollmentRepository enrollments,
                               final TrackerEventRepository trackerEvents) {
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.workflowRepo = Objects.requireNonNull(workflowRepo, "workflowRepo");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
        this.mirror = Objects.requireNonNull(mirror, "mirror");
        this.extended = Objects.requireNonNull(extended, "extended");
        this.aggregates = Objects.requireNonNull(aggregates, "aggregates");
        this.events = Objects.requireNonNull(events, "events");
        this.enrollments = Objects.requireNonNull(enrollments, "enrollments");
        this.trackerEvents = Objects.requireNonNull(trackerEvents, "trackerEvents");
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

        /* Supported binding kinds in Phase 1/2:
         *   DATA_SET      → aggregate form (Phase 1)
         *   PROGRAM_STAGE → event-stage form (Phase 2)
         * Other BindingKind values return CAPTURE_PARAM_INVALID until
         * the matching reconciler lands. */
        final FormType formType;
        final String displayName;
        if (wf.boundMetadataKind() == CaptureWorkflow.BindingKind.DATA_SET) {
            final MirroredDataSet dataSet = mirror.findDataSet(wf.boundMetadataId())
                    .orElseThrow(() -> new CaptureFormError(
                            ErrorCode.METADATA_NOT_READY,
                            "dataSet " + wf.boundMetadataId() + " not mirrored"));
            formType = FormType.AGGREGATE;
            displayName = dataSet.displayName();
        } else if (wf.boundMetadataKind() == CaptureWorkflow.BindingKind.PROGRAM_STAGE) {
            final MirroredProgramStage stage = extended.findProgramStage(wf.boundMetadataId())
                    .orElseThrow(() -> new CaptureFormError(
                            ErrorCode.METADATA_NOT_READY,
                            "program-stage " + wf.boundMetadataId() + " not mirrored"));
            formType = FormType.EVENT_STAGE;
            displayName = stage.displayName();
        } else {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "binding kind " + wf.boundMetadataKind()
                            + " not supported in phase 2");
        }

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
                formType,
                wf.boundMetadataKind().name(),
                wf.boundMetadataId(),
                displayName,
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
    // Event / program-stage endpoints (ADR-0036 phase 2)
    // ────────────────────────────────────────────────────────────────────

    /** List every mirrored stage for a program, ordered by displayName.
     *  An unmirrored program → {@link ErrorCode#METADATA_NOT_READY}. */
    public List<ProgramStageSummary> listStagesForProgram(final String programUid) {
        if (programUid == null || programUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "programUid is required");
        }
        if (mirror.findProgram(programUid).isEmpty()) {
            throw new CaptureFormError(ErrorCode.METADATA_NOT_READY,
                    "program " + programUid + " not mirrored");
        }
        return extended.listProgramStagesForProgram(programUid).stream()
                .map(s -> new ProgramStageSummary(
                        s.dhis2Uid(), s.displayName(), s.repeatable(),
                        readIntProperty(s.payload(), "sortOrder")))
                .toList();
    }

    /** Assemble a free-standing stage form from the mirror. */
    public FormAssembly assembleForProgramStage(final String programUid,
                                                  final String stageUid) {
        if (programUid == null || programUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "programUid is required");
        }
        if (stageUid == null || stageUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "stageUid is required");
        }
        final MirroredProgramStage stage = extended.findProgramStage(stageUid)
                .orElseThrow(() -> new CaptureFormError(
                        ErrorCode.METADATA_NOT_READY,
                        "program-stage " + stageUid + " not mirrored"));
        if (!programUid.equals(stage.programUid())) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "stage " + stageUid + " does not belong to program "
                            + programUid);
        }
        final List<MirroredProgramStage.ProgramStageDataElement> psdes =
                extended.findProgramStageDataElements(stageUid);
        // Index psdes by DE uid so we can look up per-field metadata
        // (compulsory + renderType) when building section groupings.
        final java.util.Map<String, MirroredProgramStage.ProgramStageDataElement>
                psdeByUid = new java.util.LinkedHashMap<>();
        for (final MirroredProgramStage.ProgramStageDataElement psde : psdes) {
            psdeByUid.put(psde.dataElementUid(), psde);
        }
        final List<MirroredProgramStageSection> sections =
                extended.findProgramStageSections(stageUid);
        final List<FormSection> formSections = new ArrayList<>();
        if (!sections.isEmpty()) {
            // Metadata-driven per-section grouping (Phase 1): one
            // FormSection per DHIS2 programStageSection, data
            // elements in the admin-configured within-section order,
            // renderType hint passed through. DEs not assigned to
            // any section are gathered into a trailing "Other" group
            // so the operator never loses access to a field (defence
            // in depth; well-configured DHIS2 metadata places every
            // DE in exactly one section).
            final java.util.Set<String> seen = new java.util.HashSet<>();
            for (final MirroredProgramStageSection sec : sections) {
                final List<FormField> secFields = new ArrayList<>();
                for (final String deUid : sec.dataElementUids()) {
                    final MirroredDataElement de =
                            mirror.findDataElement(deUid).orElse(null);
                    if (de == null) {
                        continue;
                    }
                    final MirroredProgramStage.ProgramStageDataElement
                            psde = psdeByUid.get(deUid);
                    final boolean compulsory = psde != null
                            && psde.compulsory();
                    secFields.add(new FormField(
                            deUid, deUid, null,
                            de.displayName(), null,
                            de.valueType(), readOptionSetUid(de),
                            compulsory ? Requirement.REQUIRED
                                    : Requirement.OPTIONAL,
                            psde == null ? null
                                    : psde.renderTypeDesktop()));
                    seen.add(deUid);
                }
                formSections.add(new FormSection(
                        sec.dhis2Uid(), sec.displayName(),
                        sec.sortOrder(), sec.renderTypeDesktop(),
                        secFields));
            }
            final List<FormField> unassigned = new ArrayList<>();
            for (final MirroredProgramStage.ProgramStageDataElement psde : psdes) {
                if (seen.contains(psde.dataElementUid())) {
                    continue;
                }
                final MirroredDataElement de = mirror.findDataElement(
                        psde.dataElementUid()).orElse(null);
                if (de == null) {
                    continue;
                }
                unassigned.add(new FormField(
                        psde.dataElementUid(), psde.dataElementUid(),
                        null, de.displayName(), null,
                        de.valueType(), readOptionSetUid(de),
                        psde.compulsory() ? Requirement.REQUIRED
                                : Requirement.OPTIONAL,
                        psde.renderTypeDesktop()));
            }
            if (!unassigned.isEmpty()) {
                formSections.add(new FormSection(null, "Other",
                        Integer.MAX_VALUE, null, unassigned));
            }
        } else {
            // No sections mirrored (older metadata or formType=DEFAULT):
            // fall back to the pre-Phase-1 lumped single-section
            // output so existing programs keep rendering exactly as
            // they did before this slice.
            final List<FormField> fields = new ArrayList<>();
            for (final MirroredProgramStage.ProgramStageDataElement psde : psdes) {
                final MirroredDataElement de = mirror.findDataElement(
                        psde.dataElementUid()).orElse(null);
                if (de == null) {
                    continue;
                }
                fields.add(new FormField(
                        psde.dataElementUid(), psde.dataElementUid(),
                        null, de.displayName(), null,
                        de.valueType(), readOptionSetUid(de),
                        psde.compulsory() ? Requirement.REQUIRED
                                : Requirement.OPTIONAL,
                        psde.renderTypeDesktop()));
            }
            formSections.add(new FormSection(null,
                    stage.displayName(), fields));
        }
        return new FormAssembly(
                FormType.EVENT_STAGE,
                CaptureWorkflow.BindingKind.PROGRAM_STAGE.name(),
                stageUid,
                stage.displayName(),
                new Ownership(null, null, true),
                formSections,
                List.of());
    }

    /** List events for a program × orgUnit (optionally capped). */
    public List<EventSummary> listEvents(final String programUid,
                                          final String orgUnitUid,
                                          final int limit) {
        if (programUid == null || programUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "programUid is required");
        }
        if (orgUnitUid == null || orgUnitUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "orgUnit is required");
        }
        /* DHIS2-canonical shift: unify reads across the legacy UUID
         * der.event table (populated by pre-canonical POST /api/events)
         * and the DHIS2-shaped edge_tracker_event table (populated by
         * every new event + every tracker event). The two sources
         * merge here so the operator sees one timeline regardless of
         * where each row happens to live. */
        final List<EventSummary> out = new ArrayList<>();
        for (final TrackerEvent e : trackerEvents.findByProgramAndOrgUnit(
                programUid, orgUnitUid, limit)) {
            out.add(new EventSummary(
                    e.eventUid(),
                    e.programStageUid(),
                    e.orgUnitUid(),
                    e.occurredDate() == null ? null
                            : e.occurredDate().atStartOfDay(
                                    java.time.ZoneOffset.UTC).toInstant(),
                    e.status() == null ? null : e.status().name(),
                    e.dataValues() == null ? Map.of()
                            : e.dataValues().entrySet().stream()
                                    .collect(java.util.stream.Collectors.toMap(
                                            Map.Entry::getKey,
                                            en -> String.valueOf(en.getValue()),
                                            (a, b) -> a,
                                            java.util.LinkedHashMap::new))));
        }
        for (final Event e : events.findByProgramAndOrgUnit(
                programUid, orgUnitUid, limit)) {
            out.add(new EventSummary(
                    e.eventId().toString(),
                    e.programStageUid(),
                    e.orgUnitUid(),
                    e.occurredAt(),
                    e.status() == null ? null : e.status().name(),
                    e.dataValues()));
        }
        // Most-recent-first across both sources so operators always
        // see fresh captures at the top.
        out.sort((a, b) -> {
            final var ao = a.occurredAt();
            final var bo = b.occurredAt();
            if (ao == null && bo == null) {
                return 0;
            }
            if (ao == null) {
                return 1;
            }
            if (bo == null) {
                return -1;
            }
            return bo.compareTo(ao);
        });
        return out.size() > limit ? out.subList(0, limit) : out;
    }

    /** Full event detail — row + dataValues keyed by dataElement UID.
     *  Accepts either a DHIS2 11-char UID (new canonical shape,
     *  stored in edge_tracker_event) or a legacy UUID (pre-canonical
     *  rows in der.event). Tries the canonical path first so new
     *  events don't take an extra Postgres round-trip. */
    public EventDetail getEventDetail(final String eventUid) {
        if (eventUid == null || eventUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "eventUid is required");
        }
        // Canonical path — edge_tracker_event (text PK).
        final var canonical = trackerEvents.findById(eventUid);
        if (canonical.isPresent()) {
            final var e = canonical.get();
            return new EventDetail(
                    e.eventUid(),
                    e.enrollmentUid(),
                    e.programUid(),
                    e.programStageUid(),
                    e.orgUnitUid(),
                    e.occurredDate() == null ? null
                            : e.occurredDate().atStartOfDay(
                                    java.time.ZoneOffset.UTC).toInstant(),
                    e.status() == null ? null : e.status().name(),
                    /* edge_tracker_event rows carry no attribute-option-
                     * combo today; default to the DEFAULT_COC that
                     * matches DHIS2's implicit assignment for events
                     * without category disaggregation. */
                    "HllvX50cXC0",
                    e.dataValues() == null ? Map.of()
                            : e.dataValues().entrySet().stream()
                                    .collect(java.util.stream.Collectors.toMap(
                                            Map.Entry::getKey,
                                            en -> String.valueOf(en.getValue()),
                                            (a, b) -> a,
                                            java.util.LinkedHashMap::new)),
                    e.workflowRunId());
        }
        // Legacy UUID path — der.event. Preserved so events written
        // before the DHIS2-canonical shift still resolve on the
        // detail page without a backfill migration.
        final UUID legacyUid;
        try {
            legacyUid = UUID.fromString(eventUid);
        } catch (IllegalArgumentException ex) {
            throw new CaptureFormError(ErrorCode.WORKFLOW_RUN_NOT_FOUND,
                    "event " + eventUid + " not found");
        }
        final Event e = events.findById(legacyUid)
                .orElseThrow(() -> new CaptureFormError(
                        ErrorCode.WORKFLOW_RUN_NOT_FOUND,
                        "event " + eventUid + " not found"));
        return new EventDetail(
                e.eventId().toString(),
                e.enrollmentId() == null ? null : e.enrollmentId().toString(),
                e.programUid(),
                e.programStageUid(),
                e.orgUnitUid(),
                e.occurredAt(),
                e.status() == null ? null : e.status().name(),
                e.attributeOptionComboUid(),
                e.dataValues() == null ? Map.of() : Map.copyOf(e.dataValues()),
                e.workflowRunId());
    }

    private static int readIntProperty(
            final com.fasterxml.jackson.databind.JsonNode payload,
            final String name) {
        if (payload == null) {
            return 0;
        }
        final var n = payload.path(name);
        return n.isMissingNode() || !n.isNumber() ? 0 : n.asInt();
    }

    // ────────────────────────────────────────────────────────────────────
    // Tracker / program-type reads (ADR-0036 phase 3)
    // ────────────────────────────────────────────────────────────────────

    /**
     * Program summary: display name, program type
     * (WITHOUT_REGISTRATION = single-event, WITH_REGISTRATION = tracker)
     * and the linked trackedEntityTypeUid when tracker.
     */
    public ProgramSummary resolveProgram(final String programUid) {
        if (programUid == null || programUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "programUid is required");
        }
        final MirroredProgram p = mirror.findProgram(programUid)
                .orElseThrow(() -> new CaptureFormError(
                        ErrorCode.METADATA_NOT_READY,
                        "program " + programUid + " not mirrored"));
        return new ProgramSummary(
                p.dhis2Uid(),
                p.displayName(),
                p.programType(),
                p.trackedEntityTypeUid());
    }

    /** Resolve just the TEI type for a tracker program. Non-tracker
     *  programs (WITHOUT_REGISTRATION) return 400 — the concept
     *  doesn't apply. */
    public TrackedEntityTypeRef resolveProgramTrackedEntityType(final String programUid) {
        final ProgramSummary s = resolveProgram(programUid);
        if (s.trackedEntityTypeUid() == null) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "program " + programUid + " is "
                            + (s.programType() == null ? "unknown" : s.programType())
                            + "; no trackedEntityType applies");
        }
        return new TrackedEntityTypeRef(s.trackedEntityTypeUid());
    }

    /**
     * Attributes (TEAs) known to this edge for a TEI type.
     *
     * <p>In the DHIS2 data model TEAs can be defined at the TET level
     * (payload.trackedEntityTypeAttributes) OR per-program
     * (payload.programTrackedEntityAttributes). Clients searching or
     * creating TEIs of a given type care about the union. The mirror
     * stores every TEA globally, so we project all mirrored TEAs
     * once the TET existence check passes.</p>
     */
    public List<TrackedEntityAttributeSummary> listAttributesForTeiType(final String teiTypeUid) {
        if (teiTypeUid == null || teiTypeUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "trackedEntityTypeUid is required");
        }
        if (mirror.findTrackedEntityType(teiTypeUid).isEmpty()) {
            throw new CaptureFormError(ErrorCode.METADATA_NOT_READY,
                    "trackedEntityType " + teiTypeUid + " not mirrored");
        }
        final List<TrackedEntityAttributeSummary> out = new ArrayList<>();
        for (final MirroredTrackedEntityAttribute a
                : extended.findAllTrackedEntityAttributes()) {
            out.add(new TrackedEntityAttributeSummary(
                    a.dhis2Uid(),
                    a.displayName(),
                    a.valueType(),
                    readOptionSetUidNode(a.payload()),
                    readBool(a.payload(), "searchable"),
                    a.uniqueAttribute()));
        }
        return out;
    }

    /**
     * Enrollments for a tracked entity, optionally filtered to one
     * program. The {@code programUid} filter narrows the typical
     * capture flow (a client opening a TEI card inside a given program).
     */
    public List<EnrollmentSummary> listEnrollmentsForTei(final String teiUid,
                                                          final String programUid) {
        if (teiUid == null || teiUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "teiUid is required");
        }
        final List<Enrollment> rows = enrollments.findByTei(teiUid);
        return rows.stream()
                .filter(e -> programUid == null || programUid.isBlank()
                        || programUid.equals(e.programUid()))
                .map(e -> new EnrollmentSummary(
                        e.enrollmentUid(),
                        e.teiUid(),
                        e.programUid(),
                        e.orgUnitUid(),
                        e.status() == null ? null : e.status().name(),
                        e.enrollmentDate() == null ? null
                                : e.enrollmentDate().toString(),
                        e.incidentDate() == null ? null
                                : e.incidentDate().toString(),
                        e.updatedAt()))
                .toList();
    }

    /**
     * Tracker-stage events for an enrollment. Optional
     * {@code programStageUid} filter so a client can refresh a single
     * timeline without pulling every stage.
     */
    public List<TrackerEventSummary> listEventsForEnrollment(final String enrollmentUid,
                                                               final String programStageUid) {
        if (enrollmentUid == null || enrollmentUid.isBlank()) {
            throw new CaptureFormError(ErrorCode.CAPTURE_PARAM_INVALID,
                    "enrollmentUid is required");
        }
        final List<TrackerEvent> rows = trackerEvents.findByEnrollment(enrollmentUid);
        return rows.stream()
                .filter(e -> programStageUid == null || programStageUid.isBlank()
                        || programStageUid.equals(e.programStageUid()))
                .map(e -> new TrackerEventSummary(
                        e.eventUid(),
                        e.enrollmentUid(),
                        e.programUid(),
                        e.programStageUid(),
                        e.orgUnitUid(),
                        e.status() == null ? null : e.status().name(),
                        e.occurredDate() == null ? null
                                : e.occurredDate().toString(),
                        e.updatedAt()))
                .toList();
    }

    private static String readOptionSetUidNode(
            final com.fasterxml.jackson.databind.JsonNode payload) {
        if (payload == null) {
            return null;
        }
        final var opt = payload.path("optionSet");
        if (opt.isMissingNode() || opt.isNull()) {
            return null;
        }
        final var id = opt.path("id");
        return id.isMissingNode() || id.isNull() ? null : id.asText();
    }

    private static boolean readBool(
            final com.fasterxml.jackson.databind.JsonNode payload,
            final String name) {
        if (payload == null) {
            return false;
        }
        final var n = payload.path(name);
        return !n.isMissingNode() && !n.isNull() && n.asBoolean(false);
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
            Requirement requirement,
            /**
             * Per-field DHIS2 renderType hint from the mirror
             * (DROPDOWN / VERTICAL_RADIOBUTTONS /
             * HORIZONTAL_RADIOBUTTONS / VERTICAL_CHECKBOXES /
             * HORIZONTAL_CHECKBOXES / TOGGLE / SPINNER / SLIDER /
             * AUTOCOMPLETE / DEFAULT / ...). Nullable; client
             * falls back to a value-type-chosen input when absent.
             */
            String renderType) {

        /** Back-compat shorthand for aggregate + upstream-context
         *  callers that don't carry a renderType hint. */
        public FormField(final String fieldRef,
                          final String dataElementUid,
                          final String categoryOptionComboUid,
                          final String dataElementDisplayName,
                          final String categoryOptionComboDisplayName,
                          final String valueType,
                          final String optionSetUid,
                          final Requirement requirement) {
            this(fieldRef, dataElementUid, categoryOptionComboUid,
                    dataElementDisplayName, categoryOptionComboDisplayName,
                    valueType, optionSetUid, requirement, null);
        }
    }

    public record FormSection(
            String sectionUid,
            String displayName,
            Integer sortOrder,
            /**
             * Per-section layout hint from the DHIS2 mirror
             * (LISTING / MATRIX / SEQUENTIAL). Nullable; client
             * falls back to LISTING when absent.
             */
            String renderType,
            List<FormField> fields) {

        /** Back-compat shorthand for the aggregate + lumped-fallback
         *  callers that only need (uid, name, fields). */
        public FormSection(final String sectionUid,
                            final String displayName,
                            final List<FormField> fields) {
            this(sectionUid, displayName, null, null, fields);
        }
    }

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

    public record ProgramStageSummary(
            String stageUid,
            String displayName,
            boolean repeatable,
            int sortOrder) { }

    public record EventSummary(
            /** DHIS2 Event UID — 11-char alphanumeric per standard
             *  tracker data model. Legacy UUID rows from der.event
             *  are serialised as their canonical UUID string so the
             *  client can still fetch + edit them during the
             *  post-canonical-shift transition; all newly-created
             *  events are 11-char text UIDs that match DHIS2 wire
             *  shape exactly. */
            String eventUid,
            String programStageUid,
            String orgUnitUid,
            java.time.Instant occurredAt,
            String status,
            /** Data-element → value map, same shape as
             *  {@link EventDetail#dataValues()}. Lets the Capture
             *  client render metadata-driven columns per
             *  §EV1-A without an N+1 detail fetch. */
            Map<String, String> dataValues) { }

    public record EventDetail(
            String eventUid,
            String enrollmentUid,
            String programUid,
            String programStageUid,
            String orgUnitUid,
            java.time.Instant occurredAt,
            String status,
            String attributeOptionComboUid,
            Map<String, String> dataValues,
            UUID workflowRunId) { }

    public record ProgramSummary(
            String programUid,
            String displayName,
            String programType,
            String trackedEntityTypeUid) { }

    public record TrackedEntityTypeRef(String trackedEntityTypeUid) { }

    public record TrackedEntityAttributeSummary(
            String attributeUid,
            String displayName,
            String valueType,
            String optionSetUid,
            boolean searchable,
            boolean uniqueAttribute) { }

    public record EnrollmentSummary(
            String enrollmentUid,
            String teiUid,
            String programUid,
            String orgUnitUid,
            String status,
            String enrollmentDate,
            String incidentDate,
            java.time.Instant lastUpdatedAt) { }

    public record TrackerEventSummary(
            String eventUid,
            String enrollmentUid,
            String programUid,
            String programStageUid,
            String orgUnitUid,
            String status,
            String occurredDate,
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
