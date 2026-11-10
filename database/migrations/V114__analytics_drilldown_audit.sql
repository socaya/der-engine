-- V114 — DER Analytics drilldown audit trail (spec §11, AT-14, AN-FR-047 /
-- AN-FR-050 / AN-FR-051). Every drilldown or export access against a
-- materialised cell writes one row here *before* contributing source
-- records are returned, so even an aborted response leaves an audit
-- trail. The spec is explicit: patient-level access is not a generic
-- reverse SQL query, it's a lineage operation tied to the exact cell
-- + filters, with server-side authorisation rechecked per call.
--
-- Suppression semantics (§11): when the cell is below the configured
-- small-cell threshold, DER still records the access attempt but sets
-- suppressed = TRUE and row_count = 0 so operators can't infer
-- identities through complementary totals or repeated queries.

CREATE TABLE IF NOT EXISTS der.analytics_drilldown_audit (
    audit_id          UUID PRIMARY KEY,
    user_id           UUID NOT NULL,
    role              TEXT NOT NULL,
    metric_id         UUID NOT NULL
        REFERENCES der.analytics_definition (id) ON DELETE CASCADE,
    definition_version INTEGER NOT NULL,
    period_key        TEXT NOT NULL,
    org_unit_uid      VARCHAR(24) NOT NULL,
    dimension_key     TEXT NOT NULL DEFAULT '',
    row_count         INTEGER NOT NULL DEFAULT 0,
    suppressed        BOOLEAN NOT NULL DEFAULT FALSE,
    purpose           TEXT,
    client_ip         TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_drilldown_audit_user_idx
    ON der.analytics_drilldown_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_drilldown_audit_cell_idx
    ON der.analytics_drilldown_audit
        (metric_id, period_key, org_unit_uid, dimension_key);

COMMENT ON TABLE der.analytics_drilldown_audit IS
    'Append-only audit log for every drilldown or record-detail '
    'access against an analytics cell. Spec §11 — server rechecks '
    'authorisation per call; the row is written before contributions '
    'are returned so aborts still leave a trail.';
