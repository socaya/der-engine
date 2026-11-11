-- V115 — DER Analytics central reconciliation (spec §12, AN-FR-039).
-- One row per paired (metric, period, orgUnit, dimensionKey) compare
-- between local DER value and DHIS2 central analytics value. The
-- classification column follows the spec taxonomy exactly:
--
--   LOCAL_PENDING_SYNC             — local has sources not yet
--                                    published to central
--   CENTRAL_ANALYTICS_NOT_REFRESHED — central analytics tables
--                                    haven't rebuilt since last sync
--   METADATA_VERSION_DRIFT         — definition revision differs
--   INCOMPATIBLE_FORMULA           — metric uses functions outside
--                                    central's supported matrix
--   ORGUNIT_ATTRIBUTION            — different org-unit anchor
--   DATE_ANCHOR                    — different date anchor
--   DEDUP_POLICY                   — distinct-count scope differs
--   LATE_DATA                      — local received data after the
--                                    central refresh cut-off
--   REJECTED_TRACKER_UPDATE        — referenced source write was
--                                    rejected centrally
--   REAL_MISMATCH                  — none of the above; a genuine
--                                    numeric divergence that needs
--                                    operator review
--
-- Append-mostly: one row per cell comparison is retained; a new
-- comparison upserts into the same tuple so the UI always shows
-- the latest classification without losing provenance of the last
-- central refresh cursor.

CREATE TABLE IF NOT EXISTS der.analytics_reconciliation (
    reconciliation_id       UUID PRIMARY KEY,
    metric_id               UUID NOT NULL
        REFERENCES der.analytics_definition (id) ON DELETE CASCADE,
    definition_version      INTEGER NOT NULL,
    period_key              TEXT NOT NULL,
    org_unit_uid            VARCHAR(24) NOT NULL,
    dimension_key           TEXT NOT NULL DEFAULT '',
    local_value             NUMERIC(20, 4),
    central_value           NUMERIC(20, 4),
    classification          TEXT NOT NULL
        CHECK (classification IN (
            'LOCAL_PENDING_SYNC', 'CENTRAL_ANALYTICS_NOT_REFRESHED',
            'METADATA_VERSION_DRIFT', 'INCOMPATIBLE_FORMULA',
            'ORGUNIT_ATTRIBUTION', 'DATE_ANCHOR', 'DEDUP_POLICY',
            'LATE_DATA', 'REJECTED_TRACKER_UPDATE', 'REAL_MISMATCH',
            'IN_AGREEMENT')),
    explanation             TEXT,
    central_refresh_at      TIMESTAMPTZ,
    local_source_cursor     BIGINT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT analytics_reconciliation_unique
        UNIQUE (metric_id, definition_version, period_key,
                org_unit_uid, dimension_key)
);

CREATE INDEX IF NOT EXISTS analytics_reconciliation_classification_idx
    ON der.analytics_reconciliation (classification, updated_at DESC);

CREATE INDEX IF NOT EXISTS analytics_reconciliation_metric_idx
    ON der.analytics_reconciliation
        (metric_id, period_key, org_unit_uid);

COMMENT ON TABLE der.analytics_reconciliation IS
    'Local vs. DHIS2 central comparison per materialised cell. Spec '
    '§12 — DER must not represent a local partial count as a '
    'verified replica of national totals; this table makes the '
    'reason for every divergence explicit (not just the delta).';
