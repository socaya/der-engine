-- Phase 13 / der-1.4.0-alpha.4 (ADR-0027): referral inbox scaffolding.
-- The scanner is a no-op in alpha.4; alpha.5 wires the central-query
-- logic. The schema + the poll job are the substrate.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS referral_inbox (
    inbox_id       UUID PRIMARY KEY,
    kind           TEXT NOT NULL CHECK (kind IN (
        'AGGREGATE_DATA_VALUE', 'EVENT', 'ENROLLMENT', 'TRACKED_ENTITY')),
    source_ref     TEXT NOT NULL,
    bound_org_unit TEXT NOT NULL,
    payload        JSONB NOT NULL,
    discovered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    status         TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DISMISSED'))
                                 DEFAULT 'PENDING',
    resolved_by    UUID REFERENCES edge_user(user_id),
    resolved_at    TIMESTAMPTZ,
    UNIQUE (kind, source_ref)
);

CREATE INDEX IF NOT EXISTS ix_referral_inbox_pending
    ON referral_inbox (status, discovered_at DESC)
    WHERE status = 'PENDING';
