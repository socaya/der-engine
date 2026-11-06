-- V090 — login page settings (singleton row).
--
-- One-row table in der schema, carrying the admin-authored branding
-- + copy for the sign-in screen plus an optional background image.
-- The row is seeded at migration time so callers never have to deal
-- with the "missing row" case; NULL in any text column means "fall
-- back to the client default".
SET search_path = der, public;

CREATE TABLE IF NOT EXISTS signin_setting (
    id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    layout        TEXT,             -- NULL = fall back to client default
    app_title     TEXT,
    app_intro     TEXT,
    submit_label  TEXT,
    footer_html   TEXT,
    bg_image      BYTEA,            -- NULL = use bundled default
    bg_mime       TEXT,             -- e.g. image/png, image/svg+xml
    bg_etag       TEXT,             -- sha-256 hex of bg_image, for cache
    updated_by    UUID,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO signin_setting (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
