package ug.ac.mak.der.workflow;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * One step within a {@link CaptureWorkflow}. V045 extends ADR-0018/0022
 * with explicit section-kind + section-ref so a step says exactly which
 * slice of the parent unit it captures (a dataset section, a program-stage
 * section, a TEI-attribute group, etc.).
 */
public record CaptureWorkflowStep(
        UUID stepId,
        UUID workflowId,
        int ordinal,
        String displayName,
        OwnerRole ownerRole,
        UUID ownerDeviceId,
        StepKind stepKind,
        List<CaptureWorkflowField> fields,
        /** V045 — what kind of slice this step captures. */
        SectionKind sectionKind,
        /** V045 — DHIS2 UID of the slice (null for AD_HOC). */
        String sectionRef
) {

    public CaptureWorkflowStep {
        Objects.requireNonNull(stepId, "stepId");
        Objects.requireNonNull(workflowId, "workflowId");
        if (ordinal < 0) {
            throw new IllegalArgumentException("ordinal must be >= 0");
        }
        Objects.requireNonNull(displayName, "displayName");
        if (displayName.isBlank()) {
            throw new IllegalArgumentException("displayName must not be blank");
        }
        Objects.requireNonNull(ownerRole, "ownerRole");
        Objects.requireNonNull(stepKind, "stepKind");
        fields = fields == null ? List.of() : List.copyOf(fields);
        if (sectionKind == null) {
            sectionKind = SectionKind.AD_HOC;
        }
    }

    public enum OwnerRole { ADMIN, OPERATOR, REVIEWER }

    public enum StepKind {
        /** Captures a slice of the dataset's fields. */
        CAPTURE,
        /** Read-only review pass; no field writes. */
        REVIEW,
        /** Explicit approve/reject gate. Reuses ADR-0016 mechanics. */
        APPROVE,
        /** Hands the run off to another device or role. */
        DISPATCH
    }

    /**
     * V045 — the kind of DHIS2 slice this step binds to. Combined with
     * {@link #sectionRef()} it tells the compiler which fields the step's
     * contributions belong to.
     */
    public enum SectionKind {
        /** DataSet.sections — aggregate groups of data elements. */
        DATASET_SECTION,
        /** A whole program stage (events + attributes). */
        PROGRAM_STAGE,
        /** ProgramStage.programStageSections — grouped data elements. */
        PROGRAM_STAGE_SECTION,
        /** TrackedEntityAttribute group — profile fields. */
        TEI_ATTRIBUTE_GROUP,
        /** DataElementGroup — ad-hoc grouping across stages/datasets. */
        DATA_ELEMENT_GROUP,
        /** CategoryOptionCombo split (e.g. one person captures male column). */
        COC_SPLIT,
        /** V046 — tracker enrollment layer: enrollmentDate / incidentDate /
         *  status / orgUnit + the attributes captured on the enrollment
         *  form. Only valid for PROGRAM-bound workflows. */
        ENROLLMENT_FORM,
        /** V047 — DHIS2 v2.30+ ProgramSection: a named grouping of
         *  tracked-entity attributes rendered as a section of the
         *  enrollment form. {@code sectionRef} is the ProgramSection UID.
         *  Only valid for PROGRAM-bound workflows. */
        PROGRAM_SECTION,
        /** V048 — TrackedEntityType attributes: cross-program profile
         *  fields (name, DoB, sex, national ID) that live on the TEI
         *  itself, not on any enrollment. {@code sectionRef} is the
         *  TrackedEntityType UID. Only valid for PROGRAM-bound workflows. */
        TEI_TYPE_ATTRIBUTES,
        /** Free-form field list defined only by the workflow fields[]. */
        AD_HOC
    }
}
