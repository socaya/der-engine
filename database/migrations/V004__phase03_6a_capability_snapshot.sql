-- DER DHIS2 compatibility capability snapshot — Phase 03.6a under ADR-0006.
--
-- dhis2_capability_snapshot captures, per boot (or per admin-triggered
-- refresh), the resolved view DER holds of the central DHIS2 server:
--
--   * The parsed semantic version (major/minor/patch/snapshot) from
--     /api/system/info.
--   * The static profile DER chose from that version (V2_41 .. V2_44).
--   * The dynamic probe report — the actual HTTP outcomes for a battery of
--     capability probes (tracker endpoints, legacy TEI, program rules,
--     categoryOptionCombos, dataValueSets, etc.).
--   * The final capability flags DER will serve from until the next refresh
--     (profile defaults overlaid by probe overrides).
--
-- Resolution rule: the most recent row (ORDER BY captured_at DESC LIMIT 1)
-- is the live snapshot. History is retained for audit and for ADR-0006's
-- "cached-only fallback" when central is unreachable and the engine must
-- continue serving.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS dhis2_capability_snapshot (
    snapshot_id         BIGSERIAL PRIMARY KEY,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    central_version     TEXT NOT NULL,
    central_revision    TEXT,
    central_build_time  TEXT,
    major               INT NOT NULL,
    minor               INT NOT NULL,
    patch               INT,
    is_snapshot         BOOLEAN NOT NULL,
    profile_name        TEXT NOT NULL,
    probe_report_json   JSONB NOT NULL,
    capability_json     JSONB NOT NULL,
    engine_version      TEXT NOT NULL,
    probe_reachable     BOOLEAN NOT NULL,
    probe_duration_ms   BIGINT NOT NULL DEFAULT 0,
    triggered_by        TEXT NOT NULL CHECK (triggered_by IN ('STARTUP','ADMIN_REFRESH','SCHEDULED','TEST')),
    initiator_user      UUID REFERENCES edge_user(user_id)
);

CREATE INDEX IF NOT EXISTS ix_dhis2_capability_snapshot_captured_at
    ON dhis2_capability_snapshot (captured_at DESC);

CREATE INDEX IF NOT EXISTS ix_dhis2_capability_snapshot_profile_name
    ON dhis2_capability_snapshot (profile_name);
