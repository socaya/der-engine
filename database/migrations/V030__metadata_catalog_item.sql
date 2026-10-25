-- der-2.0.17 — generic metadata catalog mirror for the long-tail of
-- DHIS2 metadata resources (optionSets, options, indicators,
-- indicatorTypes, validationRules, programIndicators, legendSets,
-- constants, attributes, categoryCombos, categoryOptions, …).
--
-- Rather than add a dedicated table per resource type, every resource
-- shares one catalog table keyed by (resource, dhis2_uid). The full
-- JSONB payload is preserved so capture-time code can project any
-- field without round-tripping to central.
CREATE TABLE IF NOT EXISTS der.metadata_catalog_item (
    resource      text        NOT NULL,
    dhis2_uid     text        NOT NULL,
    display_name  text        NOT NULL,
    payload       jsonb       NOT NULL,
    snapshot_id   bigint              REFERENCES der.metadata_snapshot(snapshot_id) ON DELETE SET NULL,
    imported_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (resource, dhis2_uid)
);
CREATE INDEX IF NOT EXISTS ix_metadata_catalog_item_resource ON der.metadata_catalog_item (resource);

COMMENT ON TABLE  der.metadata_catalog_item IS 'der-2.0.17 generic metadata mirror (resource-keyed, JSONB payload).';
COMMENT ON COLUMN der.metadata_catalog_item.resource IS 'DHIS2 web-API collection name: optionSets, indicators, validationRules, categoryCombos, …';
