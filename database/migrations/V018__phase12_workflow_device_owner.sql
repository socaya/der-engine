-- Phase 12 / der-1.3.0-alpha.1 (ADR-0022): per-step owner device.
--
-- Nullable FK to edge_device(device_id). ON DELETE SET NULL so
-- revoking / deleting a device degrades gracefully back to role-only
-- ownership instead of blowing up the workflow. Enforcement is
-- deliberately deferred to alpha.2.

SET search_path = der, public;

ALTER TABLE capture_workflow_step
    ADD COLUMN IF NOT EXISTS owner_device_id UUID
        REFERENCES edge_device(device_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_capture_workflow_step_owner_device
    ON capture_workflow_step (owner_device_id)
    WHERE owner_device_id IS NOT NULL;
