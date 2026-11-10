-- V111 — DER Analytics contribution ledger (Phase 2).
--
-- Per docs/apps/analytics/DER_Analytics_Comprehensive_Requirements_and_
-- Architecture.md §7.3 and §7.4 "incremental algorithm". One row per
-- (metric, source_key, period, orgUnit, dimension) tuple. A source
-- that changes its period or orgUnit retracts its prior contribution
-- before the new one lands; the ledger is the source of truth for
-- that retract-insert cycle.
--
-- Why a separate table rather than updating analytics_cell directly:
--   • Retraction must be symmetric and idempotent. Keeping the raw
--     contribution means replaying the same change is a no-op (the
--     prior row is identified by source_key + source_version).
--   • Non-invertible aggregations (distinct, min/max) need the full
--     contribution set to recompute; a bare running sum can't retract
--     correctly.
--   • The materializer aggregates contributions into analytics_cell
--     in one SQL pass, so no double-bookkeeping in the ingestion
--     code path.

CREATE TABLE IF NOT EXISTS der.analytics_contribution (
    metric_id             UUID NOT NULL
        REFERENCES der.analytics_definition (id) ON DELETE CASCADE,
    definition_version    INTEGER NOT NULL,
    -- source_key uniquely identifies the originating record across
    -- its lifetime (e.g. the event UID). Combined with (metric_id,
    -- definition_version) it forms the retraction key.
    source_key            VARCHAR(64) NOT NULL,
    -- source_version tracks the committed version of the source so
    -- stale replays (same change seen twice from the journal) are
    -- a no-op.
    source_version        VARCHAR(64) NOT NULL,
    period_key            VARCHAR(32) NOT NULL,
    org_unit_uid          VARCHAR(24) NOT NULL,
    dimension_key         VARCHAR(256) NOT NULL DEFAULT '',
    -- Contribution value. For COUNT metrics this is 1; for SUM
    -- metrics it's the numeric contributed by this source. NULL means
    -- the source is eligible but contributes nothing (e.g. required
    -- field missing).
    contribution_value    NUMERIC(20, 4) NOT NULL DEFAULT 1,
    -- Flag indicating the source is eligible for this metric. False
    -- means the source was evaluated and explicitly excluded (wrong
    -- program, missing state). Retained so the quality counter can
    -- report "N excluded" alongside "N contributed".
    eligibility           BOOLEAN NOT NULL DEFAULT TRUE,
    -- Lifecycle status of the source — the aggregation respects this
    -- so soft-deleted / quarantined records don't inflate counts
    -- (AN-FR-012).
    source_state          VARCHAR(16) NOT NULL DEFAULT 'COMMITTED'
        CHECK (source_state IN (
            'COMMITTED', 'DELETED', 'QUARANTINED', 'CONFLICTED',
            'REJECTED', 'DRAFT')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (metric_id, definition_version, source_key,
                 period_key, org_unit_uid, dimension_key)
);

-- Query index for the materializer: given a (metric, period, orgUnit)
-- cell, aggregate every contribution that lands in it.
CREATE INDEX IF NOT EXISTS ix_analytics_contribution_cell
    ON der.analytics_contribution
        (metric_id, definition_version, period_key,
         org_unit_uid, dimension_key)
    WHERE eligibility = TRUE AND source_state = 'COMMITTED';

-- Retraction index: given (metric, source_key) find every row to
-- remove when the source changes period / orgUnit / is deleted.
CREATE INDEX IF NOT EXISTS ix_analytics_contribution_source
    ON der.analytics_contribution
        (metric_id, definition_version, source_key);

-- Convenience index for "which cells did this source affect" queries
-- (drilldown / lineage in Phase 3).
CREATE INDEX IF NOT EXISTS ix_analytics_contribution_period
    ON der.analytics_contribution (period_key, metric_id);
