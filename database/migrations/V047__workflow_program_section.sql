-- V047: adds PROGRAM_SECTION to capture_workflow_step.section_kind.
--
-- PROGRAM_SECTION (DHIS2 v2.30+) is a named grouping of tracked-entity
-- attributes rendered as a section of the enrollment form. Distinct
-- from TEI_ATTRIBUTE_GROUP (an ad-hoc attribute group selector) and
-- ENROLLMENT_FORM (the whole enrollment layer): a PROGRAM_SECTION step
-- captures only the attributes DHIS2 declares on that section's
-- programSection.trackedEntityAttributes.
--
-- Only valid for PROGRAM-bound workflows. Compiler merges the step's
-- attributes[] contribution into the workflow-level attributes map so
-- several PROGRAM_SECTION steps combine into one enrollment form.

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
        'AD_HOC'
    ));
