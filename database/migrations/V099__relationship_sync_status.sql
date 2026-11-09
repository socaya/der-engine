-- DER Capture — relationship sync-status column (relationships
-- spec §REL-C-008, Slice A.3).
--
-- Per-row sync state for the Capture UI's "is this link synced
-- to central or not" badge. Previously the UI had to infer state
-- from central_uid (null vs filled) + deleted_at + journal
-- entries — three separate signals in three places. One
-- authoritative column makes the client simpler and future-proofs
-- additional states (CONFLICT, BLOCKED) without more inference.
--
-- States:
--   LOCAL   — newly created, drain hasn't picked it up yet.
--   PENDING — journal entry is in flight / retryable.
--   SYNCED  — central ACCEPTED, central_uid set.
--   FAILED  — central REJECTED (constraint violation, metadata
--             missing, etc.) — operator should review.
--   BLOCKED — type / endpoint metadata missing locally, cannot
--             even attempt the POST.
--   CONFLICT — central has a different version, needs operator
--              review (reconciliation screen).
--
-- Default LOCAL for new inserts; existing rows with central_uid
-- set are backfilled to SYNCED, rest stay LOCAL (they'll flip to
-- PENDING on the next drain pass).

SET search_path = der, public;

ALTER TABLE edge_tracker_relationship
    ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'LOCAL';

ALTER TABLE edge_tracker_relationship
    ADD CONSTRAINT edge_rel_sync_status_check
    CHECK (sync_status IN (
        'LOCAL', 'PENDING', 'SYNCED', 'FAILED', 'BLOCKED', 'CONFLICT'));

-- Backfill: rows with central_uid set are already synced.
UPDATE edge_tracker_relationship
   SET sync_status = 'SYNCED'
 WHERE central_uid IS NOT NULL
   AND sync_status = 'LOCAL';

-- Deleted (soft) rows should surface the pending-delete state —
-- the drain treats them as a delete operation but their last
-- known sync state is still useful for the UI.
UPDATE edge_tracker_relationship
   SET sync_status = 'PENDING'
 WHERE deleted_at IS NOT NULL
   AND central_uid IS NULL
   AND sync_status = 'LOCAL';

-- Index for the "show me unsynced relationships" admin query.
CREATE INDEX IF NOT EXISTS ix_edge_relationship_sync_status
    ON edge_tracker_relationship (sync_status)
 WHERE sync_status <> 'SYNCED';
