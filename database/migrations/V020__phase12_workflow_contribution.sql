-- Phase 12 / der-1.3.0-alpha.4 (ADR-0025): per-step contribution
-- buffer for the capture-workflow reconciler. Alpha.4 ships the
-- substrate only; drain-time recomposition lands in alpha.5+.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS capture_workflow_step_contribution (
    contribution_id      UUID PRIMARY KEY,
    run_id               UUID NOT NULL
        REFERENCES capture_workflow_run(run_id) ON DELETE CASCADE,
    step_id              UUID NOT NULL
        REFERENCES capture_workflow_step(step_id) ON DELETE CASCADE,
    payload              JSONB NOT NULL,
    submitted_by         UUID REFERENCES edge_user(user_id),
    submitted_device_id  UUID REFERENCES edge_device(device_id) ON DELETE SET NULL,
    submitted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, step_id)
);

CREATE INDEX IF NOT EXISTS ix_capture_workflow_contribution_run
    ON capture_workflow_step_contribution (run_id);
