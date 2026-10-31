-- V048: TEI_TYPE_ATTRIBUTES section kind.
--
-- A TEI_TYPE_ATTRIBUTES step captures tracked-entity type attributes
-- (DHIS2 trackedEntityType.trackedEntityTypeAttributes[]) — the
-- cross-program profile fields that live on the TrackedEntity itself
-- (name, DoB, sex, national ID) rather than on any specific
-- enrollment. Distinct from PROGRAM_SECTION and TEI_ATTRIBUTE_GROUP,
-- which both target enrollment-form attributes.
--
-- Compiler lifts these into a dedicated `trackedEntity.attributes[]`
-- block on the compiled DHIS2 payload so the import matches the
-- tracker API shape:
--     { trackedEntity: { attributes: [...] },
--       enrollment:    { attributes: [...] } }
--
-- Only valid for PROGRAM-bound workflows.

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
        'AD_HOC'
    ));
