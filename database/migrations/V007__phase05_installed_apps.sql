-- Phase 05 part B (ADR-0005 FINALIZED): custom DHIS2 app hosting.
--
-- DER accepts .zip bundles that match DHIS2's manifest.webapp spec,
-- extracts them under ~/.der/apps/<app-key>/<version>/ and serves the
-- static files at /dhis-web-<app-key>/.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS installed_app (
    app_id         UUID PRIMARY KEY,
    app_key        TEXT NOT NULL,
    version        TEXT NOT NULL,
    display_name   TEXT NOT NULL,
    manifest_json  JSONB NOT NULL,
    install_path   TEXT NOT NULL,
    installed_by   UUID NOT NULL REFERENCES edge_user(user_id),
    installed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (app_key, version)
);

CREATE INDEX IF NOT EXISTS ix_installed_app_key ON installed_app (app_key);
