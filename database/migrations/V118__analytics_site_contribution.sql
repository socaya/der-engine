-- V118 — DER Analytics server-side site contribution ledger
-- (spec §8 FR-DIS-002..003). Each row is one accepted packet
-- produced by a remote site; the uniqueness constraint
-- (siteId, metricId, periodKey, orgUnitUid, dimensionKey,
-- sourceCursor) is the dedup key so a retried delivery never
-- double-counts.
--
-- consolidated flips to TRUE when the aggregator has folded the
-- packet into the central roll-up. Gate 6.3 maintains that
-- lifecycle; Gate 6.2 only lands the receive + dedup surface.

CREATE TABLE IF NOT EXISTS der.analytics_site_contribution (
    packet_id             UUID PRIMARY KEY,
    site_id               TEXT NOT NULL,
    metric_id             UUID NOT NULL
        REFERENCES der.analytics_definition (id) ON DELETE CASCADE,
    definition_version    INTEGER NOT NULL,
    period_key            TEXT NOT NULL,
    org_unit_uid          VARCHAR(24) NOT NULL,
    dimension_key         TEXT NOT NULL DEFAULT '',
    source_cursor         BIGINT NOT NULL,
    count_value           BIGINT NOT NULL,
    sum_value             NUMERIC(20, 4),
    min_value             NUMERIC(20, 4),
    max_value             NUMERIC(20, 4),
    numerator_value       NUMERIC(20, 4),
    denominator_value     NUMERIC(20, 4),
    produced_at           TIMESTAMPTZ NOT NULL,
    received_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum_hex          TEXT NOT NULL,
    consolidated          BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT analytics_site_contribution_dedup
        UNIQUE (site_id, metric_id, definition_version, period_key,
                org_unit_uid, dimension_key, source_cursor)
);

CREATE INDEX IF NOT EXISTS analytics_site_contribution_cell_idx
    ON der.analytics_site_contribution
        (metric_id, period_key, org_unit_uid);

CREATE INDEX IF NOT EXISTS analytics_site_contribution_pending_idx
    ON der.analytics_site_contribution (consolidated)
    WHERE consolidated = FALSE;

COMMENT ON TABLE der.analytics_site_contribution IS
    'Accepted site contribution packets on the server consolidator. '
    'Dedup is by (site, metric, period, orgUnit, dim, cursor); a '
    'retried delivery hits the unique constraint and is dropped. '
    'Gate 6.3 flips consolidated as packets fold into the central '
    'roll-up.';
