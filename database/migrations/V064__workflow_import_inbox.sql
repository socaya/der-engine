-- V064: Receive-side import inbox (§62–§63 trust layer).
--
-- When a peer POSTs /workflows/import?inbox=true the receiving edge
-- parks the canonical JSON here instead of writing to capture_workflow
-- directly. An operator on the receiving edge reviews each incoming
-- doc and either applies it (which runs the normal import service)
-- or rejects it. Default behaviour of /workflows/import is unchanged
-- for backward compat; the sender opts in.

SET search_path = der, public;

CREATE TABLE workflow_import_inbox (
    import_id       UUID PRIMARY KEY,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_by     UUID REFERENCES edge_user(user_id),
    from_label      TEXT,          -- e.g. the peer's display name when known
    display_name    TEXT NOT NULL, -- extracted from the canonical doc
    bound_kind      TEXT NOT NULL,
    bound_id        TEXT NOT NULL,
    canonical_json  JSONB NOT NULL,
    status          TEXT NOT NULL
                    CHECK (status IN ('PENDING','ACCEPTED','REJECTED')),
    decided_at      TIMESTAMPTZ,
    decided_by      UUID REFERENCES edge_user(user_id),
    decision_note   TEXT,
    accepted_workflow_id UUID REFERENCES capture_workflow(workflow_id)
                       ON DELETE SET NULL
);

CREATE INDEX idx_workflow_import_inbox_status
    ON workflow_import_inbox (status, received_at DESC);
