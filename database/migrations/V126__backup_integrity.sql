-- V126 — FR-14-06..10 integrity verification (daily lightweight path).
--
-- The weekly pg_restore shadow-DB check (V039) is expensive. For the
-- daily operator contract we need a cheaper "the archive on disk
-- hasn't rotted" probe. That probe needs an anchor sha256 captured
-- at backup time. Adding one column to backup_run (not a whole new
-- table) keeps the lookup trivially joinable and avoids a new FK.

ALTER TABLE der.backup_run
    ADD COLUMN IF NOT EXISTS archive_sha256 TEXT;

COMMENT ON COLUMN der.backup_run.archive_sha256 IS
    'FR-14-06 — hex SHA-256 of the archive file written by BackupWorker, '
    'anchor for BackupIntegrityService daily probe.';

-- Integrity probes reuse the existing der.backup_verification table so
-- operators have a single history view. New outcome tags are string
-- constants (no CHECK constraint on this column by design — the V039
-- schema deliberately leaves it open so lightweight + shadow-restore
-- outcomes can coexist):
--     INTEGRITY_SUCCESS   — size + sha256 match the recorded anchor
--     INTEGRITY_MISMATCH  — size or sha256 drift detected
--     INTEGRITY_MISSING   — archive file path unreadable
--     INTEGRITY_SKIPPED   — no eligible backup (anchor missing, etc.)
