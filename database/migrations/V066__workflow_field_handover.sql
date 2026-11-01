-- V066: Per-field handover overrides.
--
-- Up to now every data element / TEA inside a CaptureWorkflowStep
-- was captured by the step's owner device + role. Field-level
-- handover lets a workflow route individual fields to a different
-- device (e.g. a central ID assignment keyed by the ID clerk after
-- Demographics has been captured by Registration).
--
-- Both columns are nullable → NULL means "inherit from the parent
-- step". A workflow that uses no per-field overrides is byte-for-byte
-- identical in behaviour to the pre-V066 model.
--
-- WorkflowCompiler + WorkflowRunCoordinator consume these columns in
-- a follow-up change; the schema lands here so operators can start
-- configuring the intent via the admin UI.

SET search_path = der, public;

ALTER TABLE capture_workflow_field
    ADD COLUMN owner_role TEXT,
    ADD COLUMN owner_device_id UUID
        REFERENCES edge_device(device_id) ON DELETE SET NULL;

ALTER TABLE capture_workflow_field
    ADD CONSTRAINT capture_workflow_field_owner_role_valid
    CHECK (owner_role IS NULL OR owner_role IN ('ADMIN', 'OPERATOR', 'REVIEWER'));
