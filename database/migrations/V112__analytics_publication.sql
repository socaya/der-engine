-- V112 — DER Analytics aggregate publication (spec §4.5, §7.3,
-- Phase 5). One row per proposed dataValueSet cell: the operator
-- authored a mapping from an analytics metric cell to a target
-- (dataset, dataElement, COC, AOC, period, orgUnit), the engine
-- picks up the current value, the row gets reviewed by a human
-- gate before it ever hits DHIS2.
--
-- State machine mirrors spec §7.2:
--   PROPOSED  → system-generated from a cell
--   APPROVED  → reviewer accepted; ready to drain to Central
--   REJECTED  → reviewer declined with reason
--   PUBLISHED → actually posted to DHIS2 dataValueSets
--   RECONCILED → Central responded with the same value we proposed
--   DIVERGED  → Central responded different; needs re-review

CREATE TABLE IF NOT EXISTS der.analytics_publication_mapping (
    mapping_id             UUID PRIMARY KEY,
    metric_id              UUID NOT NULL
        REFERENCES der.analytics_definition (id) ON DELETE CASCADE,
    definition_version     INTEGER NOT NULL,
    dataset_uid            VARCHAR(24) NOT NULL,
    data_element_uid       VARCHAR(24) NOT NULL,
    category_option_combo_uid     VARCHAR(24) NOT NULL,
    attribute_option_combo_uid    VARCHAR(24) NOT NULL,
    dimension_filter       JSONB,
    publication_mode       TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED'
        CHECK (publication_mode IN (
            'REVIEW_REQUIRED', 'AUTO_APPROVE_EXACT',
            'AUTO_APPROVE_UNDER_THRESHOLD')),
    overlap_policy         TEXT NOT NULL DEFAULT 'EXCLUSIVE_CELL_OWNER',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_analytics_publication_mapping_metric
    ON der.analytics_publication_mapping (metric_id, definition_version);

CREATE UNIQUE INDEX IF NOT EXISTS ux_analytics_publication_mapping_target
    ON der.analytics_publication_mapping (
        metric_id, definition_version,
        dataset_uid, data_element_uid,
        category_option_combo_uid, attribute_option_combo_uid);


CREATE TABLE IF NOT EXISTS der.analytics_publication (
    proposal_id                  UUID PRIMARY KEY,
    mapping_id                   UUID NOT NULL
        REFERENCES der.analytics_publication_mapping (mapping_id)
        ON DELETE CASCADE,
    metric_id                    UUID NOT NULL
        REFERENCES der.analytics_definition (id) ON DELETE CASCADE,
    definition_version           INTEGER NOT NULL,
    dataset_uid                  VARCHAR(24) NOT NULL,
    data_element_uid             VARCHAR(24) NOT NULL,
    category_option_combo_uid    VARCHAR(24) NOT NULL,
    attribute_option_combo_uid   VARCHAR(24) NOT NULL,
    period_key                   VARCHAR(32) NOT NULL,
    org_unit_uid                 VARCHAR(24) NOT NULL,
    proposed_value               NUMERIC(20, 4),
    reviewed_value               NUMERIC(20, 4),
    state                        TEXT NOT NULL DEFAULT 'PROPOSED'
        CHECK (state IN (
            'PROPOSED', 'APPROVED', 'REJECTED',
            'PUBLISHED', 'RECONCILED', 'DIVERGED')),
    review_reason                TEXT,
    reviewed_by                  UUID,
    reviewed_at                  TIMESTAMPTZ,
    provenance                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_analytics_publication_state
    ON der.analytics_publication (state);

CREATE INDEX IF NOT EXISTS ix_analytics_publication_metric_period
    ON der.analytics_publication (metric_id, period_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_analytics_publication_target
    ON der.analytics_publication (
        mapping_id, period_key, org_unit_uid);
