-- V124 — Central app auto-sync (DER-APPS-DHIS2-001 Phase 4,
--        FR-SYNC-001..003, FR-SYNC-005, FR-SYNC-007).
--
-- Every scheduled run writes one row to app_central_sync_run so the
-- /system/apps admin diagnostic can show "last sync was at …, N
-- installed, M failed." Dry-run previews are stored with
-- dry_run = true so admins can audit what the next real run would do
-- before approving auto-sync for a tenant.
--
-- Rows are retained for 90 days (sweep job in Phase 5 — intentionally
-- not shipped here).

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS app_central_sync_run (
    run_id            UUID PRIMARY KEY,
    started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ,
    outcome           TEXT NOT NULL DEFAULT 'RUNNING'
                        CHECK (outcome IN
                            ('RUNNING', 'OK', 'PARTIAL', 'FAILED', 'SKIPPED')),
    message           TEXT,
    dry_run           BOOLEAN NOT NULL DEFAULT false,
    triggered_by      UUID REFERENCES edge_user(user_id) ON DELETE SET NULL,
    discovered_count  INT NOT NULL DEFAULT 0,
    installed_count   INT NOT NULL DEFAULT 0,
    updated_count     INT NOT NULL DEFAULT 0,
    skipped_count     INT NOT NULL DEFAULT 0,
    failed_count      INT NOT NULL DEFAULT 0,
    detail_json       JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_app_central_sync_run_started_at
    ON app_central_sync_run (started_at DESC);

COMMENT ON TABLE app_central_sync_run IS
    'One row per APPS_SYNC_FROM_CENTRAL execution (scheduled or '
    'admin-triggered). Carries counters for the /system/apps '
    'diagnostic and the per-candidate detail for post-hoc audit '
    '(DER-APPS-DHIS2-001 FR-SYNC-001..005).';
