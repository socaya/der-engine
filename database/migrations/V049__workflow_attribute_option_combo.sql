-- V049: ATTRIBUTE_OPTION_COMBO section kind.
--
-- An ATTRIBUTE_OPTION_COMBO step captures a specific funding stream /
-- project / donor disaggregation across ALL three DHIS2 domains:
--   * aggregate dataValues[]: dataValue.attributeOptionCombo
--   * event programs:         event.attributeOptionCombo
--   * tracker enrollments:    enrollment.attributeOptionCombo
--
-- sectionRef on the step is the DHIS2 AttributeOptionCombo UID. The
-- compiler stamps every dataValue / event that step contributes with
-- that AOC UID so DHIS2 can split value populations by funder.
--
-- Valid under every parent binding (cross-cutting).

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
        'AD_HOC'
    ));
