-- V121 — DHIS2 app support (DER-APPS-DHIS2-001 Phase 2).
--
-- Introduces the hybrid-dispatcher columns on der.installed_app so the
-- catalogue can tell the client which host to mount an app in:
--
--   * host_kind     — DER_ESM (signed ESM React component) or
--                     DHIS2_IFRAME (sandboxed iframe serving
--                     /dhis-web-<appKey>/)
--   * source        — DER_BUILTIN (shipped with server),
--                     MANUAL_UPLOAD (admin pushed through /admin/apps),
--                     CENTRAL_SYNC (Phase 4 scheduled sync from DHIS2
--                     central)
--   * trust_level   — SIGNED (Ed25519 signature verified) vs
--                     UNSIGNED (DHIS2_IFRAME apps only, gated by the
--                     apps.allow-unsigned-central admin setting)
--   * last_opened_at — telemetry for the /system/apps diagnostic
--                     screen so admins can spot abandoned installs
--   * central_app_id — identity pin for Phase 4 central-sync, used to
--                     compare local vs central version
--
-- All columns default-populate existing rows as DER_BUILTIN / DER_ESM /
-- SIGNED so no application change is required to upgrade in place.

SET search_path = der, public;

ALTER TABLE installed_app
    ADD COLUMN IF NOT EXISTS host_kind TEXT NOT NULL DEFAULT 'DER_ESM'
        CHECK (host_kind IN ('DER_ESM', 'DHIS2_IFRAME')),
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'MANUAL_UPLOAD'
        CHECK (source IN ('DER_BUILTIN', 'MANUAL_UPLOAD', 'CENTRAL_SYNC')),
    ADD COLUMN IF NOT EXISTS trust_level TEXT NOT NULL DEFAULT 'SIGNED'
        CHECK (trust_level IN ('SIGNED', 'UNSIGNED')),
    ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS central_app_id TEXT;

CREATE INDEX IF NOT EXISTS ix_installed_app_host_kind
    ON installed_app (host_kind);

CREATE INDEX IF NOT EXISTS ix_installed_app_central_app_id
    ON installed_app (central_app_id)
    WHERE central_app_id IS NOT NULL;

COMMENT ON COLUMN installed_app.host_kind IS
    'DER_ESM vs DHIS2_IFRAME — picked at install time from the manifest '
    'shape; drives client dispatcher host selection.';

COMMENT ON COLUMN installed_app.source IS
    'DER_BUILTIN | MANUAL_UPLOAD | CENTRAL_SYNC — provenance so admins '
    'know how each installed app got here.';

COMMENT ON COLUMN installed_app.trust_level IS
    'SIGNED (Ed25519 verified) vs UNSIGNED (DHIS2_IFRAME apps only, '
    'per apps.allow-unsigned-central admin setting).';
