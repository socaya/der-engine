-- V053: DATASET_ELEMENT section kind.
--
-- Captures one specific DataSet element row — the (dataElement,
-- optional categoryCombo override) pair declared on
-- DataSet.dataSetElements[]. In practice a step owns ONE data element
-- across all its disaggregation rows, so sectionRef holds the data
-- element UID and the compiler stamps dataElement onto every
-- contributed dataValue that doesn't already carry one.
--
-- Finer than DATA_ELEMENT_GROUP (several DEs) and distinct from
-- DATASET_SECTION (a named sub-form). Useful when a single DE needs
-- a dedicated capture responsibility — e.g. for high-stakes
-- indicators subject to supervisor sign-off.
--
-- Only valid for DATA_SET-bound workflows (aggregate-only metadata).

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
        'DATASET_ELEMENT',
        'AD_HOC'
    ));
