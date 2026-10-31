-- V056: canonical_workflow_state — the materialised merged state per
-- workflow run.
--
-- Spec §11.2: "The canonical state is the current merged representation
-- consumed by users, dependent workflows, validation, and sync."
--
-- Separate from the operation journal (which is the durable history).
-- Each contribution triggers a re-merge; the result is stored here so
-- downstream workflow steps and dependency checks can read the latest
-- materialised view without recomputing.

SET search_path = der, public;

CREATE TABLE canonical_workflow_state (
    run_id         UUID PRIMARY KEY
                   REFERENCES capture_workflow_run(run_id) ON DELETE CASCADE,
    revision       INT NOT NULL DEFAULT 1,
    payload        JSONB NOT NULL,
    completeness   TEXT NOT NULL DEFAULT 'PARTIAL'
                   CHECK (completeness IN ('EMPTY','PARTIAL','COMPLETE')),
    computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_contributor_user_id   UUID REFERENCES edge_user(user_id),
    last_contributor_device_id UUID REFERENCES edge_device(device_id)
);

CREATE INDEX idx_canonical_workflow_state_completeness
    ON canonical_workflow_state (completeness);
CREATE INDEX idx_canonical_workflow_state_computed_at
    ON canonical_workflow_state (computed_at DESC);
