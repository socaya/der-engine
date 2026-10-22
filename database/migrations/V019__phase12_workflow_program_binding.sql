-- Phase 12 / der-1.3.0-alpha.3 (ADR-0024): relax capture_workflow
-- binding to accept PROGRAM + PROGRAM_STAGE in addition to DATA_SET.
-- Existing rows are all DATA_SET; the new CHECK is a strict superset.

SET search_path = der, public;

ALTER TABLE capture_workflow
    DROP CONSTRAINT IF EXISTS capture_workflow_bound_metadata_kind_check;

ALTER TABLE capture_workflow
    ADD CONSTRAINT capture_workflow_bound_metadata_kind_check
    CHECK (bound_metadata_kind IN ('DATA_SET', 'PROGRAM', 'PROGRAM_STAGE'));
