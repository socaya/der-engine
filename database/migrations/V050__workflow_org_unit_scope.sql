-- V050: ORG_UNIT_SCOPE section kind.
--
-- Supports edges serving multiple sub-org-units below the one DER is
-- bound to. Typical cases:
--   * District edge: one DER instance serves N health centres;
--     each ORG_UNIT_SCOPE step binds to a sub-OU UID
--   * Hospital edge: ward-level sub-OUs (OPD / maternity / lab)
--   * OU-group splits: ad-hoc groupings
--
-- sectionRef is the sub-OU UID (child of the edge's bound OU). The
-- compiler stamps every dataValue / event / enrollment contributed by
-- the step with that orgUnit UID. If the edge is a single-OU facility,
-- the step is still legal — the stamp is just a no-op annotation.
--
-- Cross-cutting: valid under every parent binding.

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
        'AD_HOC'
    ));
