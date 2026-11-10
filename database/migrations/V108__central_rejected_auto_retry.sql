-- SM-4d — auto-retry window for CENTRAL_REJECTED.
--
-- Some central rejections are transient (concurrent ACTIVE clash
-- that a second-later flip resolves, metadata replication lag,
-- intermittent dependency ordering). Without a retry window the
-- row sits in the admin "Needs attention" queue forever even when
-- the underlying condition has cleared. This migration adds a
-- marker so the reaper can flip a row from CENTRAL_REJECTED back
-- to PENDING exactly once (per rejection cycle) without risking
-- infinite loops.

SET search_path = der, public;

ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS last_auto_retry_at TIMESTAMPTZ;

COMMENT ON COLUMN operation_journal.last_auto_retry_at IS
    'SM-4d — timestamp of the last auto-retry attempt by the CentralRejectedReaper. Non-null means the row has already had its auto-retry chance; a human admin action is required from this point on.';
