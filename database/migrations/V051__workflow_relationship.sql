-- V051: RELATIONSHIP section kind.
--
-- Captures DHIS2 Tracker TEI relationships (mother ↔ child, index case
-- ↔ contact, caregiver ↔ patient, household head ↔ member). The step's
-- sectionRef is the RelationshipType UID (defines the from/to
-- constraints). Payload contains relationships[] with {from, to,
-- relationshipType}; compiler merges by (from, to, relationshipType)
-- and emits as a top-level relationships[] block on the compiled
-- tracker payload.
--
-- Only valid for PROGRAM-bound workflows (tracker programs). A later
-- release may surface relationships at enrollment level too.

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
        'AD_HOC'
    ));
