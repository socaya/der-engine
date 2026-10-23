-- V028 — admin settings (cron overrides + feature flags).
--
-- Single-row key/value store so the admin UI's /settings screen can
-- read + persist operator-tunable configuration without touching
-- .env.local. Secrets stay environment-only; this table only holds
-- non-sensitive runtime knobs.

CREATE TABLE IF NOT EXISTS der.admin_setting (
    key          TEXT PRIMARY KEY,
    value        JSONB NOT NULL,
    updated_by   UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE der.admin_setting IS
    'G1: operator-tunable settings (cron overrides, feature flags). Secrets stay environment-only.';
