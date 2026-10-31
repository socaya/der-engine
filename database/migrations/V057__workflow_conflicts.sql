-- V057: workflow conflict table (spec §48–§50).
--
-- When the WorkflowRunCoordinator calls the ConflictDetector after
-- each contribution, every divergent identity is recorded here. The
-- run stays in state AWAITING until every row with status =
-- PENDING_REVIEW has been resolved; only then can it transition to
-- COMPLETED and emit the submission to operation_journal.
--
-- `identity_json`  — the logical identity key, e.g.
--     {"kind":"AGGREGATE_CELL","dataElement":"DE1","categoryOptionCombo":"COC1",...}
--     {"kind":"EVENT_FIELD","event":"UID","dataElement":"DE1"}
--     {"kind":"TEI_ATTRIBUTE","trackedEntity":"UID","attribute":"ATTR_UID"}
--
-- `versions`       — JSONB array, one entry per contribution that
--                     touched this identity: { contributionId, stepId,
--                     value, submittedBy, submittedDeviceId, submittedAt }.
--
-- `resolution_strategy` is one of the spec §50 options the operator
--     chose (LATEST_WINS / EARLIEST_WINS / MANUAL / DISMISSED / etc.).

SET search_path = der, public;

CREATE TABLE workflow_conflict (
    conflict_id          UUID PRIMARY KEY,
    run_id               UUID NOT NULL
                         REFERENCES capture_workflow_run(run_id) ON DELETE CASCADE,
    canonical_revision   INT NOT NULL,
    category             TEXT NOT NULL CHECK (category IN (
                            'VALUE_CONFLICT',
                            'EVENT_DATA_VALUE_CONFLICT',
                            'TEI_ATTRIBUTE_CONFLICT',
                            'RELATIONSHIP_CONFLICT',
                            'IDENTITY_CONFLICT',
                            'COMPLETION_CONFLICT')),
    identity_key         TEXT NOT NULL,       -- stable key for dedup
    identity_json        JSONB NOT NULL,
    versions             JSONB NOT NULL,
    status               TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
                         CHECK (status IN (
                            'PENDING_REVIEW',
                            'RESOLVED_AUTOMATICALLY',
                            'RESOLVED_MANUALLY',
                            'DISMISSED')),
    resolution_strategy  TEXT,
    resolution_value     JSONB,
    resolved_by          UUID REFERENCES edge_user(user_id),
    resolved_at          TIMESTAMPTZ,
    detected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, identity_key)             -- idempotent on re-detect
);

CREATE INDEX idx_workflow_conflict_run       ON workflow_conflict (run_id);
CREATE INDEX idx_workflow_conflict_pending
    ON workflow_conflict (run_id)
    WHERE status = 'PENDING_REVIEW';
