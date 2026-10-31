-- V059: workflow pinning to a metadata snapshot (spec §37–§42).
--
-- A workflow may pin itself to a specific snapshot so operators keep
-- the schema it was authored against even when upstream DHIS2 drifts.
-- When pinned, downstream validators + field candidate endpoints MUST
-- resolve metadata from that snapshot. When NULL, the workflow floats
-- with the live mirror (today's behaviour).
--
-- The FK is ON DELETE SET NULL so retiring a snapshot does not
-- cascade-delete workflows; they drop back to the floating state.

SET search_path = der, public;

ALTER TABLE capture_workflow
    ADD COLUMN pinned_snapshot_id BIGINT
        REFERENCES metadata_snapshot(snapshot_id) ON DELETE SET NULL;

CREATE INDEX idx_capture_workflow_pinned_snapshot
    ON capture_workflow (pinned_snapshot_id)
    WHERE pinned_snapshot_id IS NOT NULL;

-- A snapshot can also be marked retired so operators see which old
-- snapshots are kept only for existing pins (vs. candidates for new
-- pins). Retired snapshots stay in place; the UI greys them.
ALTER TABLE metadata_snapshot
    ADD COLUMN retired_at TIMESTAMPTZ,
    ADD COLUMN retired_by UUID REFERENCES edge_user(user_id);
