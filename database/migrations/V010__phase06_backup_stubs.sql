-- Phase 06 Release 3 (0.6.0-alpha.3): backup / restore audit stubs.
-- ADR-0011 — Phase 07 ships the actual pg_dump orchestration. For now
-- these two tables record admin intent so EA-23..26 have persistent
-- storage behind their status UIs.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS backup_run (
    run_id       BIGSERIAL PRIMARY KEY,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    requested_by UUID NOT NULL REFERENCES edge_user(user_id),
    kind         TEXT NOT NULL CHECK (kind IN ('AUDIT','FULL')),
    status       TEXT NOT NULL CHECK (status IN ('REQUESTED','QUEUED','SUCCESS','FAILED')),
    message      TEXT
);

CREATE TABLE IF NOT EXISTS restore_run (
    run_id       BIGSERIAL PRIMARY KEY,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    requested_by UUID NOT NULL REFERENCES edge_user(user_id),
    source       TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('REQUESTED','QUEUED','SUCCESS','FAILED')),
    message      TEXT
);
