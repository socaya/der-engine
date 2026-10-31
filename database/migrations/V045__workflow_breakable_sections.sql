-- V045: breakable-section workflows.
--
-- A DER workflow is a data-collection unit (dataset / program / program-stage
-- / program-stage-section) that is broken into one or more sections, each
-- section assigned to a specific user+device for capture, then compiled back
-- into a single submission and sent through approval.
--
-- Three changes here:
--   1. capture_workflow.bound_metadata_kind now also accepts
--      PROGRAM_STAGE_SECTION so a whole workflow can bind to just a section.
--   2. capture_workflow gets a workflow-level approval flag + default device,
--      so operators don't have to assign the same device to every step.
--   3. capture_workflow_step gets structured section binding: section_kind
--      (what kind of slice this step captures) + section_ref (the DHIS2 UID
--      of the slice). This replaces the earlier model of treating field_ref
--      strings as the only scope hint.

SET search_path = der, public;

-- ─── Workflow-level fields ────────────────────────────────────
ALTER TABLE capture_workflow
    DROP CONSTRAINT IF EXISTS capture_workflow_bound_metadata_kind_check;

ALTER TABLE capture_workflow
    ADD CONSTRAINT capture_workflow_bound_metadata_kind_check
    CHECK (bound_metadata_kind IN
        ('DATA_SET','PROGRAM','PROGRAM_STAGE','PROGRAM_STAGE_SECTION'));

ALTER TABLE capture_workflow
    ADD COLUMN IF NOT EXISTS requires_approval  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS default_device_id  UUID
        REFERENCES der.edge_device(device_id) ON DELETE SET NULL;

-- ─── Step-level section binding ───────────────────────────────
ALTER TABLE capture_workflow_step
    ADD COLUMN IF NOT EXISTS section_kind TEXT NOT NULL DEFAULT 'AD_HOC',
    ADD COLUMN IF NOT EXISTS section_ref  TEXT;

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
        'AD_HOC'
    ));

CREATE INDEX IF NOT EXISTS idx_capture_workflow_step_section
    ON capture_workflow_step (section_kind, section_ref);
