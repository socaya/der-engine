-- V119 — DER Analytics preaggregation proposal ledger
-- (SRS FR-INC-013). The Gate 8 proposer emits advisory
-- rollup candidates ranked by workload; this table is the
-- durable surface operators review and approve/reject.
--
-- A shape_key uniquely identifies the query shape (same PHI-safe
-- SHA-256 the planner feedback store uses) and is the natural
-- dedup axis — the service upserts into the open PROPOSED row
-- for a shape instead of creating a parallel one.

CREATE TABLE IF NOT EXISTS der.analytics_preagg_proposal (
    proposal_id           UUID PRIMARY KEY,
    shape_key             TEXT NOT NULL,
    observations          BIGINT NOT NULL,
    avg_elapsed_millis    DOUBLE PRECISION NOT NULL,
    score                 DOUBLE PRECISION NOT NULL,
    estimated_bytes       BIGINT NOT NULL,
    first_observed_at     TIMESTAMPTZ NOT NULL,
    last_observed_at      TIMESTAMPTZ NOT NULL,
    rationale             TEXT NOT NULL DEFAULT '',
    state                 TEXT NOT NULL,
    decision_reason       TEXT,
    decided_by            UUID,
    decided_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT analytics_preagg_proposal_state_chk CHECK (
        state IN ('PROPOSED', 'APPROVED', 'REJECTED', 'RETIRED')
    )
);

-- At most one open proposal per shape. Closed (REJECTED/RETIRED)
-- rows stay as history and don't conflict with new proposals.
CREATE UNIQUE INDEX IF NOT EXISTS analytics_preagg_proposal_open_shape_idx
    ON der.analytics_preagg_proposal (shape_key)
    WHERE state IN ('PROPOSED', 'APPROVED');

CREATE INDEX IF NOT EXISTS analytics_preagg_proposal_state_idx
    ON der.analytics_preagg_proposal (state, score DESC);

COMMENT ON TABLE der.analytics_preagg_proposal IS
    'Advisory preaggregation candidates (SRS FR-INC-013). Gate 8 '
    'proposer upserts PROPOSED rows; admin transitions to APPROVED '
    'or REJECTED. Materialisation of approved rows lands in a later '
    'gate.';
