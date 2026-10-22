-- DER Phase 05 scheduler sidecars + drift snapshot + journal conflict review.
-- Quartz's own qrtz_* tables are auto-initialised by Spring Boot via
-- spring.quartz.jdbc.initialize-schema (see application.yml); this migration
-- only adds DER-specific sidecars so operators have a stable view regardless
-- of Quartz version.
--
-- ADR-0008: scheduled resync + drift detection.
-- ADR-0009: conflict-review API over the operation journal.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS scheduled_job_run (
    run_id         BIGSERIAL PRIMARY KEY,
    job_name       TEXT NOT NULL,
    started_at     TIMESTAMPTZ NOT NULL,
    finished_at    TIMESTAMPTZ,
    outcome        TEXT NOT NULL CHECK (outcome IN ('STARTED','SUCCESS','FAILED','SKIPPED')),
    duration_ms    BIGINT,
    detail         JSONB,
    triggered_by   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_scheduled_job_run_job_name_started
    ON scheduled_job_run (job_name, started_at DESC);

CREATE TABLE IF NOT EXISTS drift_snapshot (
    drift_id        BIGSERIAL PRIMARY KEY,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    snapshot_from   BIGINT NOT NULL,
    snapshot_to     BIGINT NOT NULL,
    fingerprint_from TEXT,
    fingerprint_to   TEXT,
    deltas_json      JSONB NOT NULL,
    triggered_by     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_drift_snapshot_captured_at
    ON drift_snapshot (captured_at DESC);

ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS supersedes UUID REFERENCES operation_journal(operation_id);
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES edge_user(user_id);
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS resolution_rationale TEXT;
