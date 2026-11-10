-- V110 — DER Analytics engine foundation tables.
--
-- Per docs/apps/analytics/DER_Analytics_Comprehensive_Requirements_and_
-- Architecture.md §7.3. Phase 1 scope: definition catalogue, canonical
-- cell projection, and the per-stream source cursor. Phase 2 adds the
-- contribution ledger + aggregate publication tables (one slice per
-- piece so each lands with its tests + migration).
--
-- Naming: `analytics_*` to avoid colliding with the existing lightweight
-- FacilitySummary analytics (which the operational summary endpoint
-- keeps using).
--
-- Rationale for check constraints:
--   support_state  = per AN-FR-003 / AN-FR-004 — definitions must be
--                    classified unsupported rather than silently zero.
--   quality_state  = per AN-FR-025 — provisional vs verified vs failed
--                    is a visible attribute, not just a comment column.
--   analytics_type = DHIS2 compat (§4.1) — only known values accepted.
--
-- Encryption at rest + per-site tenancy (AN-FR-055, NFR-014) are
-- enforced at platform level; this migration keeps the schema plain so
-- the existing DER tenancy guard (single-site edge) applies without
-- further column additions. Multi-site rollouts extend with a
-- `site_id UUID NOT NULL DEFAULT '…'` column in a follow-up migration.

CREATE TABLE IF NOT EXISTS der.analytics_definition (
    id                   UUID PRIMARY KEY,
    source_uid           VARCHAR(24),
    code                 VARCHAR(64) NOT NULL,
    display_name         TEXT NOT NULL,
    definition_version   INTEGER NOT NULL,
    metadata_hash        TEXT NOT NULL,
    analytics_type       TEXT NOT NULL
        CHECK (analytics_type IN ('EVENT', 'ENROLLMENT', 'AGGREGATE', 'DERIVED')),
    aggregation_type     TEXT NOT NULL
        CHECK (aggregation_type IN (
            'SUM', 'AVERAGE', 'COUNT', 'STDDEV', 'VARIANCE',
            'MIN', 'MAX', 'COUNT_DISTINCT', 'CUSTOM', 'NONE')),
    program_uid          VARCHAR(24),
    stage_uids           TEXT,
    date_anchor          TEXT NOT NULL
        CHECK (date_anchor IN (
            'EVENT_DATE', 'ENROLLMENT_DATE', 'INCIDENT_DATE',
            'DISCHARGE_DATE', 'SUBMISSION_DATE')),
    org_unit_anchor      TEXT NOT NULL
        CHECK (org_unit_anchor IN (
            'EVENT_ORG_UNIT', 'ENROLLMENT_ORG_UNIT',
            'REGISTRATION_ORG_UNIT', 'TRACKED_ENTITY_ORG_UNIT')),
    compiled_ast         JSONB,
    support_state        TEXT NOT NULL DEFAULT 'READY'
        CHECK (support_state IN (
            'IMPORTED', 'PARSED', 'READY', 'UNSUPPORTED', 'DEPRECATED')),
    unsupported_reason   TEXT,
    definition           JSONB NOT NULL,
    effective_from       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_analytics_definition_code_version
    ON der.analytics_definition (code, definition_version);

CREATE INDEX IF NOT EXISTS ix_analytics_definition_support_state
    ON der.analytics_definition (support_state);

CREATE INDEX IF NOT EXISTS ix_analytics_definition_source_uid
    ON der.analytics_definition (source_uid)
    WHERE source_uid IS NOT NULL;


-- Materialised cell projection — the authoritative read surface for the
-- analytics UI. Phase 1 writes to this table only via manual admin
-- recompute or the test seed; Phase 2 wires the incremental engine that
-- upserts here from the contribution ledger.
CREATE TABLE IF NOT EXISTS der.analytics_cell (
    metric_id             UUID NOT NULL
        REFERENCES der.analytics_definition (id) ON DELETE CASCADE,
    definition_version    INTEGER NOT NULL,
    period_key            VARCHAR(32) NOT NULL,
    org_unit_uid          VARCHAR(24) NOT NULL,
    -- dimension_key is a stable encoding of category/disagg filters so
    -- a single metric can produce multiple cells per (period, orgUnit).
    -- '' means "no disaggregation" — kept explicit to preserve PK.
    dimension_key         VARCHAR(256) NOT NULL DEFAULT '',
    count_value           BIGINT,
    sum_value             NUMERIC(20, 4),
    value                 NUMERIC(20, 4),
    numerator_value       NUMERIC(20, 4),
    denominator_value     NUMERIC(20, 4),
    source_version_hash   TEXT,
    freshness_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    quality_state         TEXT NOT NULL DEFAULT 'PROVISIONAL'
        CHECK (quality_state IN (
            'PROVISIONAL', 'VERIFIED', 'PROPOSED', 'APPROVED',
            'PUBLISHED', 'RECONCILED', 'DIVERGED', 'SUPPRESSED', 'FAILED')),
    quality_notes         JSONB,
    PRIMARY KEY (metric_id, definition_version, period_key,
                 org_unit_uid, dimension_key)
);

CREATE INDEX IF NOT EXISTS ix_analytics_cell_period
    ON der.analytics_cell (period_key, metric_id);

CREATE INDEX IF NOT EXISTS ix_analytics_cell_org_unit
    ON der.analytics_cell (org_unit_uid, period_key);

CREATE INDEX IF NOT EXISTS ix_analytics_cell_quality_state
    ON der.analytics_cell (quality_state)
    WHERE quality_state IN ('FAILED', 'DIVERGED', 'SUPPRESSED');


-- Durable source-stream cursor — the ingestion consumer advances this
-- so restart replay is bounded. Spec §7.4 "advance cursor and commit"
-- step.
CREATE TABLE IF NOT EXISTS der.analytics_source_cursor (
    stream        VARCHAR(64) PRIMARY KEY,
    cursor_value  BIGINT NOT NULL DEFAULT 0,
    lag_seconds   INTEGER NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
