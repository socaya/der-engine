-- V052: EVENT_INSTANCE section kind.
--
-- An EVENT_INSTANCE step captures ONE specific event within a
-- repeating program stage. For example, a mother's ANC visits —
-- ANC1 / ANC2 / ANC3 / ANC4 — are four event instances of the same
-- ANC_VISIT stage, each captured by (potentially) a different person.
--
-- sectionRef on the step is the DHIS2 event UID. The compiler stamps
-- that UID onto any event the step contributes (if the payload
-- doesn't set event already), and the event dedupe key prefers the
-- explicit UID when present so the same event can't be duplicated
-- when multiple steps split capture across its fields.
--
-- Valid under PROGRAM, PROGRAM_STAGE, and PROGRAM_STAGE_SECTION
-- bindings — all three can host an event instance.

SET search_path = der, public;

ALTER TABLE capture_workflow_step
    DROP CONSTRAINT IF EXISTS capture_workflow_step_section_kind_check;

ALTER TABLE capture_workflow_step
    ADD CONSTRAINT capture_workflow_step_section_kind_check
    CHECK (section_kind IN (
        'DATASET_SECTION',
        'PROGRAM_STAGE',
        'PROGRAM_STAGE_SECTION',
        'TEI_ATTRIBUTE_GROUP',
        'DATA_ELEMENT_GROUP',
        'COC_SPLIT',
        'ENROLLMENT_FORM',
        'PROGRAM_SECTION',
        'TEI_TYPE_ATTRIBUTES',
        'ATTRIBUTE_OPTION_COMBO',
        'ORG_UNIT_SCOPE',
        'RELATIONSHIP',
        'EVENT_INSTANCE',
        'AD_HOC'
    ));
