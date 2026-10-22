-- DER metadata mirror — Phase 03 under ADR-0004 (hybrid).
--
-- DER emulates DHIS2's Web API at the edge. For the client to work offline it
-- needs the metadata the central DHIS2 would serve. These tables are the
-- local, append-plus-upsert mirror of five DHIS2 metadata entity types.
--
-- Each row carries:
--   * dhis2_uid        — DHIS2's own 11-char UID (business key)
--   * display_name     — denormalised for cheap list rendering
--   * payload          — the full DHIS2 JSON object, so projections to
--                        /api/* responses can include whichever fields the
--                        client's @dhis2/app-runtime Data Engine selects
--   * snapshot_id      — the metadata_snapshot batch this row was last
--                        touched by, for drift detection in Phase 05
--   * imported_at / last_seen_at — provenance

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS metadata_snapshot (
    snapshot_id      BIGSERIAL PRIMARY KEY,
    imported_from    TEXT NOT NULL,                    -- central DHIS2 base URL at sync time
    imported_by      UUID,                             -- edge_user acting; nullable for Phase 05 scheduler
    imported_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    organisation_units_count INT NOT NULL DEFAULT 0,
    data_elements_count       INT NOT NULL DEFAULT 0,
    data_sets_count           INT NOT NULL DEFAULT 0,
    programs_count            INT NOT NULL DEFAULT 0,
    tracked_entity_types_count INT NOT NULL DEFAULT 0,
    central_version  TEXT,                             -- /api/system/info.version
    central_revision TEXT,                             -- /api/system/info.revision
    fingerprint      TEXT                              -- SHA-256 of the concat of child row UIDs for drift
);
CREATE INDEX IF NOT EXISTS ix_metadata_snapshot_imported_at ON metadata_snapshot (imported_at DESC);

CREATE TABLE IF NOT EXISTS metadata_organisation_unit (
    dhis2_uid    TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    path         TEXT,                                -- DHIS2 "/root/parent/self" path
    level        INT,
    parent_uid   TEXT,
    payload      JSONB NOT NULL,
    snapshot_id  BIGINT REFERENCES metadata_snapshot(snapshot_id) ON DELETE SET NULL,
    imported_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_metadata_organisation_unit_parent ON metadata_organisation_unit (parent_uid);
CREATE INDEX IF NOT EXISTS ix_metadata_organisation_unit_level ON metadata_organisation_unit (level);

CREATE TABLE IF NOT EXISTS metadata_data_element (
    dhis2_uid    TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    value_type   TEXT,                                -- NUMBER, TEXT, BOOLEAN, etc.
    domain_type  TEXT,                                -- AGGREGATE or TRACKER
    payload      JSONB NOT NULL,
    snapshot_id  BIGINT REFERENCES metadata_snapshot(snapshot_id) ON DELETE SET NULL,
    imported_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_metadata_data_element_domain ON metadata_data_element (domain_type);

CREATE TABLE IF NOT EXISTS metadata_data_set (
    dhis2_uid    TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    period_type  TEXT,                                -- Monthly, Daily, Weekly, Yearly, etc.
    payload      JSONB NOT NULL,
    snapshot_id  BIGINT REFERENCES metadata_snapshot(snapshot_id) ON DELETE SET NULL,
    imported_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metadata_program (
    dhis2_uid    TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    program_type TEXT,                                -- WITH_REGISTRATION, WITHOUT_REGISTRATION
    tracked_entity_type_uid TEXT,
    payload      JSONB NOT NULL,
    snapshot_id  BIGINT REFERENCES metadata_snapshot(snapshot_id) ON DELETE SET NULL,
    imported_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_metadata_program_type ON metadata_program (program_type);

CREATE TABLE IF NOT EXISTS metadata_tracked_entity_type (
    dhis2_uid    TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    payload      JSONB NOT NULL,
    snapshot_id  BIGINT REFERENCES metadata_snapshot(snapshot_id) ON DELETE SET NULL,
    imported_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
