-- DER Capture — relationship edge-write sync columns (relationships
-- slice 2).
--
-- Round 2 of full-emulation relationships. Round 1 (V094) mirrored
-- relationship type metadata; this slice extends the existing
-- edge_tracker_relationship table (built for FR-08-06 referential
-- integrity, without central sync) with the sync-tracking columns
-- the drain needs:
--
--   * central_uid — DHIS2's server-assigned relationship UID once
--     drained, null until then. Expected to equal relationship_uid
--     for DHIS2 versions that accept client-supplied UIDs.
--   * updated_at — mutation timestamp for drain ordering.
--   * deleted_at — soft-delete timestamp. The drain posts a DELETE
--     to central before the row is purged; final purge happens
--     after central acknowledges.
--   * relationship_version — optimistic lock on in-place mutation,
--     bumps on each soft-delete / resurrect so a replayed drain
--     doesn't resurrect a deleted row.
--
-- Pattern mirrors event / tracked_entity_instance sync tracking.
-- No data migration needed — existing rows get central_uid = NULL
-- (treated as "needs sync") and version = 1.

SET search_path = der, public;

ALTER TABLE edge_tracker_relationship
    ADD COLUMN IF NOT EXISTS central_uid TEXT;
ALTER TABLE edge_tracker_relationship
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE edge_tracker_relationship
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE edge_tracker_relationship
    ADD COLUMN IF NOT EXISTS relationship_version INT NOT NULL DEFAULT 1;

/* Partial index on the dirty-subset so the drain pass skims only
 * rows that still need central sync (every historical row doesn't
 * get re-scanned on every drain tick). */
CREATE INDEX IF NOT EXISTS ix_edge_relationship_pending_sync
    ON edge_tracker_relationship (updated_at)
    WHERE central_uid IS NULL;
