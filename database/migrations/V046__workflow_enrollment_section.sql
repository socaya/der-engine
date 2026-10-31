-- V046: adds ENROLLMENT_FORM to the capture_workflow_step.section_kind
-- vocabulary.
--
-- An ENROLLMENT_FORM step captures the enrollment layer of a tracker
-- program: enrollmentDate / incidentDate / enrollment status + org unit
-- + the tracked-entity attributes recorded on the enrollment form.
-- Only valid for workflows whose parent binding is PROGRAM. The
-- compiler merges this contribution into the top-level enrollment of
-- the compiled payload.

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
        'AD_HOC'
    ));
