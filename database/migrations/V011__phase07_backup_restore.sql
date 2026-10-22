-- Phase 07 (ADR-0012): backup / restore engine columns.
--
-- V010 shipped the stub `backup_run` + `restore_run` tables; alpha.3's EA-23..26
-- UI records REQUESTED intent only. Phase 07 adds the columns the pg_dump
-- worker needs to record archive path, size, S3 key, and timing.

SET search_path = der, public;

ALTER TABLE backup_run
    ADD COLUMN IF NOT EXISTS archive_path TEXT;
ALTER TABLE backup_run
    ADD COLUMN IF NOT EXISTS archive_bytes BIGINT;
ALTER TABLE backup_run
    ADD COLUMN IF NOT EXISTS remote_key TEXT;
ALTER TABLE backup_run
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE backup_run
    ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE backup_run
    ADD COLUMN IF NOT EXISTS pg_dump_version TEXT;

ALTER TABLE restore_run
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE restore_run
    ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE restore_run
    ADD COLUMN IF NOT EXISTS archive_path TEXT;
ALTER TABLE restore_run
    ADD COLUMN IF NOT EXISTS kind TEXT CHECK (kind IN ('LOCAL','REMOTE','UPLOAD'));

CREATE INDEX IF NOT EXISTS ix_backup_run_requested_at
    ON backup_run (requested_at DESC);
CREATE INDEX IF NOT EXISTS ix_restore_run_requested_at
    ON restore_run (requested_at DESC);
