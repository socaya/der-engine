-- V123 — Async tracker-import envelope (DER-APPS-DHIS2-001 FR-EMU-004).
--
-- DHIS2's modern /api/tracker surface lets clients opt into an async
-- import with `?async=true`. The server returns a job id immediately
-- and clients poll /api/tracker/jobs/{id} until it reports completion.
-- DER's tracker import is already fast (inline local write), but the
-- DHIS2 web apps and the Android Capture app hard-code the async flow,
-- so we persist a job row and return the DHIS2-shaped envelope.
--
-- The persisted row carries the ImportSummary verbatim (as JSONB) so
-- a client that reconnects after the request finished can still poll
-- the outcome. Rows are retained for 7 days — older rows get cleaned
-- out by a background sweep (not in this migration).

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS tracker_job (
    job_id        UUID PRIMARY KEY,
    status        TEXT NOT NULL CHECK (status IN (
                     'RUNNING', 'COMPLETED', 'FAILED')),
    user_id       UUID REFERENCES edge_user(user_id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    summary_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS ix_tracker_job_user_created
    ON tracker_job (user_id, created_at DESC);

COMMENT ON TABLE tracker_job IS
    'Persisted ImportSummary of an async /api/tracker call. Polled '
    'by DHIS2 apps via /api/tracker/jobs/{id} (DER-APPS-DHIS2-001 '
    'FR-EMU-004). Rows are retained for 7 days.';
