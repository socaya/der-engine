package ug.ac.mak.der.workflow;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** DER capture workflow — a data-collection unit (dataset / program /
 *  program-stage / program-stage-section) broken into one or more sections,
 *  each section assigned to a specific device for capture, compiled back
 *  into a single submission, optionally gated by approval. ADR-0018 slice A
 *  + ADR-0024 program binding + V045 breakable sections. */
public record CaptureWorkflow(
        UUID workflowId,
        String displayName,
        BindingKind boundMetadataKind,
        String boundMetadataId,
        boolean enabled,
        int version,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy,
        List<CaptureWorkflowStep> steps,
        List<CaptureWorkflowDependency> dependencies,
        /** V045 — single approval gate for the compiled submission. Steps
         *  can still carry a dedicated APPROVE step_kind for mid-flow
         *  review; this flag is the final sign-off before DHIS2 upload. */
        boolean requiresApproval,
        /** V045 — the workflow's default assignee. Individual steps may
         *  override via {@link CaptureWorkflowStep#ownerDeviceId()}. Null
         *  means every step must bind to a device explicitly. */
        UUID defaultDeviceId
) {

    public CaptureWorkflow {
        Objects.requireNonNull(workflowId, "workflowId");
        Objects.requireNonNull(displayName, "displayName");
        if (displayName.isBlank()) {
            throw new IllegalArgumentException("displayName must not be blank");
        }
        Objects.requireNonNull(boundMetadataKind, "boundMetadataKind");
        Objects.requireNonNull(boundMetadataId, "boundMetadataId");
        if (boundMetadataId.isBlank()) {
            throw new IllegalArgumentException("boundMetadataId must not be blank");
        }
        if (version < 1) {
            throw new IllegalArgumentException("version must be >= 1");
        }
        steps = steps == null ? List.of() : List.copyOf(steps);
        dependencies = dependencies == null ? List.of() : List.copyOf(dependencies);
    }

    /** V045 — four parent-unit kinds across aggregate + tracker + event,
     *  plus V073's SYSTEM slot used by server-managed workflows
     *  (WEB_APP_CAPTURE, REFERRAL_INGEST, CENTRAL_DOWNLOAD,
     *  EVENT_CAPTURE, TRACKER_CAPTURE). */
    public enum BindingKind {
        DATA_SET,
        DATA_SET_SECTION,
        DATA_ELEMENT,
        PROGRAM,
        PROGRAM_SECTION,
        PROGRAM_STAGE,
        PROGRAM_STAGE_SECTION,
        TRACKED_ENTITY_TYPE,
        TRACKED_ENTITY_ATTRIBUTE,
        SYSTEM
    }
}
