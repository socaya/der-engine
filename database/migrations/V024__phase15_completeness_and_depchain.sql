-- Phase 15 / der-2.0.1-alpha.2 — close FR-06-06 + FR-12-03 schema gaps.

SET search_path = der, public;

-- FR-06-06: dataset-completeness state (DHIS2 CompleteDataSetRegistration).
CREATE TABLE IF NOT EXISTS dataset_completion (
    data_set_uid              TEXT NOT NULL,
    org_unit_uid              TEXT NOT NULL,
    period_iso                TEXT NOT NULL,
    attribute_option_combo    TEXT NOT NULL DEFAULT 'HllvX50cXC0',
    completed                 BOOLEAN NOT NULL DEFAULT TRUE,
    completed_by              UUID REFERENCES edge_user(user_id),
    completed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (data_set_uid, org_unit_uid, period_iso, attribute_option_combo)
);

CREATE INDEX IF NOT EXISTS ix_dataset_completion_period
    ON dataset_completion (period_iso, data_set_uid);
