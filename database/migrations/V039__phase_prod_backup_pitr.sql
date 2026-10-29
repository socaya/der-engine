-- V039 — §5 Backup + DR production hardening: WAL archiving for
-- point-in-time recovery, scheduled restore verification.

-- 1. WAL segment tracking for PITR. Postgres archive_command fires
-- a shell call per segment; we insert a row for each archived file
-- so operators see the window of PITR safety.
CREATE TABLE IF NOT EXISTS der.wal_segment (
    segment_id      BIGSERIAL PRIMARY KEY,
    filename        TEXT NOT NULL UNIQUE,
    archive_path    TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    archived_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_at     TIMESTAMPTZ,
    upload_destination TEXT,
    sha256          TEXT
);

CREATE INDEX IF NOT EXISTS idx_wal_segment_archived
    ON der.wal_segment(archived_at DESC);

COMMENT ON TABLE der.wal_segment IS
    '§5 PITR — Postgres WAL segments archived by archive_command.';

-- Default retention: keep WAL for 7 days post-latest-base-backup.
INSERT INTO der.retention_policy (category, keep_days, description) VALUES
    ('wal_segment', 7, 'PITR WAL segments')
ON CONFLICT (category) DO NOTHING;

-- 2. Backup verification history — a scheduled worker restores the
-- latest backup to a shadow database, counts rows, hashes a subset
-- of tables, and compares to known-good anchors.
CREATE TABLE IF NOT EXISTS der.backup_verification (
    verification_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_run_id      BIGINT,
    verified_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    outcome            TEXT NOT NULL,  -- SUCCESS | FAILURE | SKIPPED
    duration_ms        BIGINT,
    shadow_db_name     TEXT,
    row_counts         JSONB,
    reason             TEXT
);

CREATE INDEX IF NOT EXISTS idx_backup_verification_recent
    ON der.backup_verification(verified_at DESC);

COMMENT ON TABLE der.backup_verification IS
    '§5 — Scheduled restore-test history. "Backups you have not '
    'restored from are backups you do not have."';

INSERT INTO der.retention_policy (category, keep_days, description) VALUES
    ('backup_verification', 90, 'Backup restore-test history')
ON CONFLICT (category) DO NOTHING;
