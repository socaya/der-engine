-- V067: Append-only step state transition log.
--
-- Prior to this, step state (BLOCKED / READY / IN_PROGRESS / COMPLETE)
-- was computed dynamically in WorkflowRunCoordinator from the run +
-- contribution tables. That is correct for the operator's live view,
-- but it leaves no record of WHEN each transition happened, which
-- means admin monitoring cannot compute wait time (BLOCKED → READY →
-- IN_PROGRESS gap) or service time (IN_PROGRESS → COMPLETE gap).
--
-- V067 adds an append-only audit so wait + service percentiles can
-- be derived over a trailing window. One row per transition.

SET search_path = der, public;

CREATE TABLE capture_workflow_step_transition (
    transition_id      BIGSERIAL PRIMARY KEY,
    workflow_id        UUID NOT NULL REFERENCES capture_workflow(workflow_id)
                            ON DELETE CASCADE,
    run_id             UUID NOT NULL REFERENCES capture_workflow_run(run_id)
                            ON DELETE CASCADE,
    step_id            UUID NOT NULL REFERENCES capture_workflow_step(step_id)
                            ON DELETE CASCADE,
    from_state         TEXT CHECK (from_state IS NULL OR from_state IN
                            ('BLOCKED','READY','IN_PROGRESS','COMPLETE')),
    to_state           TEXT NOT NULL CHECK (to_state IN
                            ('BLOCKED','READY','IN_PROGRESS','COMPLETE')),
    transitioned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_device_id    UUID,
    actor_user_id      UUID
);

-- Fast lookup for a given run's history + for windowed metrics.
CREATE INDEX ix_capture_workflow_step_transition_run_step
    ON capture_workflow_step_transition (run_id, step_id, transitioned_at);
CREATE INDEX ix_capture_workflow_step_transition_wf_at
    ON capture_workflow_step_transition (workflow_id, transitioned_at);
CREATE INDEX ix_capture_workflow_step_transition_at
    ON capture_workflow_step_transition (transitioned_at);
