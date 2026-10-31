-- V058: Progressive validation issues (spec §36).
--
-- Each contribution to a workflow run can be checked against the
-- step's required-field rules, cross-step uniqueness, and payload
-- shape. The validator runs on every contribute() and persists its
-- findings here so the UI can surface them inline next to the
-- canonical state.
--
-- A row's lifecycle: INSERT on every validator pass; the validator
-- clears + rewrites all rows for a run in one transaction so stale
-- issues (now fixed) disappear automatically.

SET search_path = der, public;

CREATE TABLE workflow_validation_issue (
    issue_id       UUID PRIMARY KEY,
    run_id         UUID NOT NULL
                   REFERENCES capture_workflow_run(run_id) ON DELETE CASCADE,
    step_id        UUID REFERENCES capture_workflow_step(step_id)
                   ON DELETE SET NULL,
    code           TEXT NOT NULL,
    severity       TEXT NOT NULL
                   CHECK (severity IN ('ERROR','WARNING','INFO')),
    message        TEXT NOT NULL,
    field_ref      TEXT,
    detected_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_validation_issue_run
    ON workflow_validation_issue (run_id, detected_at DESC);
CREATE INDEX idx_workflow_validation_issue_severity
    ON workflow_validation_issue (severity);
