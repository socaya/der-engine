-- V054: PERIOD_SCOPE section kind.
--
-- Period / time split for aggregate dataset workflows — one person
-- captures Q1 2026, another captures Q2 2026 for the same dataset.
-- Useful for backfills of historical data where capture
-- responsibility is split by reporting period.
--
-- sectionRef on the step is the DHIS2 period expression ("2026Q1",
-- "202601", "2026W15", …). The compiler stamps `period` onto each
-- dataValue the step contributes and extends the dedup key with
-- period so Q1 and Q2 slices stay as distinct rows on one compiled
-- submission.
--
-- Only valid for DATA_SET-bound workflows (aggregate-only — events
-- carry occurredAt timestamps, not period strings).

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
        'PERIOD_SCOPE',
        'AD_HOC'
    ));
