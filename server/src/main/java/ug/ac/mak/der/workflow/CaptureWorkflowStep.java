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
        /** V049 — funder / project / donor split via AttributeOptionCombo.
         *  Cross-cutting across every parent binding. {@code sectionRef}
         *  is the AOC UID; the compiler stamps every dataValue / event
         *  contributed by this step with that UID so DHIS2 can split
         *  value populations by funder. */
        ATTRIBUTE_OPTION_COMBO,
        /** V050 — sub-OU split for edges that serve more than one
         *  org unit (district edges, hospital wards, OU groups).
         *  {@code sectionRef} is the sub-OU UID; the compiler stamps
         *  {@code orgUnit} on every dataValue / event / enrollment the
         *  step contributes. Cross-cutting across every parent binding;
         *  a no-op annotation when the edge is a single-OU facility. */
        ORG_UNIT_SCOPE,
        /** V051 — DHIS2 Tracker TEI relationships (mother ↔ child,
         *  index ↔ contact, caregiver ↔ patient). {@code sectionRef}
         *  is the RelationshipType UID; the compiler merges each
         *  payload's relationships[] into a dedicated top-level
         *  relationships[] block on the compiled tracker payload.
         *  Only valid for PROGRAM-bound workflows. */
        RELATIONSHIP,
        /** V052 — a single event occurrence within a repeating program
         *  stage (ANC1 of the ANC_VISIT stage). {@code sectionRef} is
         *  the event UID; the compiler stamps it onto every event the
         *  step contributes and makes the event UID the primary dedupe
         *  key so parallel steps can split capture across one event's
         *  fields without overwriting. Valid under PROGRAM /
         *  PROGRAM_STAGE / PROGRAM_STAGE_SECTION bindings. */
        EVENT_INSTANCE,
        /** V053 — a specific DataSet element row (data element plus
         *  optional categoryCombo override). {@code sectionRef} is the
         *  data element UID; the compiler stamps it on every dataValue
         *  the step contributes when the payload doesn't already set
         *  one. Useful when a single high-stakes DE needs a dedicated
         *  capture responsibility. Only valid for DATA_SET workflows. */
        DATASET_ELEMENT,
        /** V054 — period / time split for aggregate workflows (one
         *  person captures Q1 2026, another captures Q2 2026 of the
         *  same dataset). {@code sectionRef} is the DHIS2 period
         *  expression ("2026Q1" / "202601" / "2026W15" / …); the
         *  compiler stamps it on every dataValue the step contributes
         *  and extends the dedup key with period so Q1 and Q2 slices
         *  stay distinct. Only valid for DATA_SET workflows. */
        PERIOD_SCOPE,
        /** Free-form field list defined only by the workflow fields[]. */
        AD_HOC
    }
}
