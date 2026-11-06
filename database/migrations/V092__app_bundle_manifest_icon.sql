-- V092 — DHIS2-style bundle packaging (manifest.webapp + icon).
--
-- Install flow now accepts a .zip containing:
--     manifest.webapp   (JSON, loosely DHIS2-shaped, with DER extensions)
--     bundle.js         (ESM entry — the signed executable artifact)
--     icon.svg|png|...  (optional)
--
-- The signing boundary is unchanged — Ed25519 still signs bundle.js bytes
-- only, never the zip envelope.  The manifest is stored verbatim (raw JSON
-- string parsed via JSONB) alongside the version so the device shell can
-- read DHIS2-standard fields without round-tripping through the DER
-- catalogue columns, and the icon is served from its own public endpoint
-- (GET /edge-api/v1/apps/{appId}/{version}/icon) with immutable caching.
SET search_path = der, public;

ALTER TABLE installed_app_version
    ADD COLUMN IF NOT EXISTS manifest_json JSONB,
    ADD COLUMN IF NOT EXISTS icon_bytes    BYTEA,
    ADD COLUMN IF NOT EXISTS icon_mime     TEXT,
    ADD COLUMN IF NOT EXISTS icon_etag     TEXT;
