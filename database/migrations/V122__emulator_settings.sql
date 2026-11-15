-- V122 — DHIS2 emulator gap-fill (DER-APPS-DHIS2-001 Phase 3).
--
-- Adds the three persistence stores the Phase 3 controllers need:
--
--   * user_setting      — per-user preference key/value (FR-EMU-001)
--   * system_setting    — per-appliance preference key/value (FR-EMU-002)
--   * emulator_miss     — rolling count of unmirrored /api/* calls so the
--                         /system/apps admin diagnostic (FR-DIAG-002) can
--                         show which endpoints apps are actually asking
--                         for. One row per (endpoint, appOrigin) tuple
--                         with a hit counter and a last_at timestamp —
--                         bounded cardinality by design.
--
-- Values are stored as TEXT (not JSONB) because DHIS2's /api/userSettings
-- surface is historically "string-flavoured" — the few integer / boolean
-- settings serialise as string in the DHIS2 response too, and avoiding
-- JSONB here means we don't need a schema per setting key.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS user_setting (
    user_id       UUID NOT NULL REFERENCES edge_user(user_id) ON DELETE CASCADE,
    setting_key   TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, setting_key)
);

CREATE INDEX IF NOT EXISTS ix_user_setting_key
    ON user_setting (setting_key);

CREATE TABLE IF NOT EXISTS system_setting (
    setting_key   TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_by    UUID REFERENCES edge_user(user_id),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emulator_miss (
    endpoint      TEXT NOT NULL,
    app_origin    TEXT NOT NULL DEFAULT '',
    hit_count     BIGINT NOT NULL DEFAULT 1,
    first_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (endpoint, app_origin)
);

CREATE INDEX IF NOT EXISTS ix_emulator_miss_last_at
    ON emulator_miss (last_at DESC);

COMMENT ON TABLE user_setting IS
    'Per-user key/value store surfaced by the DHIS2 emulator at '
    '/api/userSettings — DER-APPS-DHIS2-001 FR-EMU-001.';

COMMENT ON TABLE system_setting IS
    'Per-appliance key/value store surfaced by the DHIS2 emulator at '
    '/api/systemSettings — DER-APPS-DHIS2-001 FR-EMU-002.';

COMMENT ON TABLE emulator_miss IS
    'Rolling counter of unmirrored /api/* endpoint hits per '
    '(endpoint, appOrigin) tuple. Fed by the catch-all proxy fallback '
    'when the path is not in the emulator mirror or the proxy '
    'allow-list; surfaced by the /system/apps admin diagnostic '
    '(FR-DIAG-002) so admins can prioritise expanding the mirror.';
