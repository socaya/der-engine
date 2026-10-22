-- Phase 06 Release 1 (DC-17): user drafts.
--
-- Each row is a work-in-progress payload the device-client has not yet
-- promoted to a committed write. Payload shape is intentionally opaque
-- JSONB so the schema does not change per workflow type.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS draft (
    draft_id   UUID PRIMARY KEY,
    owner_id   UUID NOT NULL REFERENCES edge_user(user_id),
    kind       TEXT NOT NULL,
    title      TEXT NOT NULL,
    payload    JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_draft_owner_updated
    ON draft (owner_id, updated_at DESC);
