-- V128 — app-data-store mirror for the DHIS2
-- `/api/dataStore/<ns>/<key>` CRUD surface.
--
-- DHIS2 custom apps (eregisters, Capture) use dataStore as their
-- per-app config / lookup store — namespaced JSON blobs keyed by
-- arbitrary strings. Without a local mirror, every dataStore
-- read 404s on DER and the app can't boot.
--
-- Shape mirrors DHIS2 central's exact wire contract so a stock
-- app can't tell the difference:
--   /api/dataStore                      → list of namespaces
--   /api/dataStore/<ns>                 → list of keys in ns
--   /api/dataStore/<ns>/<key>           → the JSON value
--   /api/dataStore/<ns>/<key>/metaData  → audit metadata
--
-- Multi-tenancy: DHIS2 dataStore is NOT per-user; it's a shared
-- namespace. Keep that posture so app behavior matches central.

CREATE TABLE IF NOT EXISTS der.app_data_store (
    data_store_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace       TEXT NOT NULL,
    data_key        TEXT NOT NULL,
    value_json      JSONB NOT NULL,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT app_data_store_key_nonempty CHECK (length(data_key) > 0),
    CONSTRAINT app_data_store_ns_nonempty  CHECK (length(namespace) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_app_data_store_ns_key
    ON der.app_data_store (namespace, data_key);

CREATE INDEX IF NOT EXISTS ix_app_data_store_namespace
    ON der.app_data_store (namespace);

COMMENT ON TABLE der.app_data_store IS
    'DHIS2 /api/dataStore mirror — per-app key/value JSON store. '
    'Namespace-scoped, NOT per-user (matches DHIS2 central).';
