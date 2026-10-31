-- V061: Workflow peer registry (spec §62–§63 pilot slice).
--
-- Operators register other edge instances they want to share workflow
-- definitions with. A peer is identified by its base URL + a human
-- label. Pushing a workflow to a peer POSTs its canonical JSON to the
-- peer's /workflows/import endpoint.
--
-- Secrets (auth token for the peer) stay in environment config, not
-- in this table — pilots typically run on a shared VPN with shared
-- bootstrap credentials.

SET search_path = der, public;

CREATE TABLE workflow_peer (
    peer_id          UUID PRIMARY KEY,
    display_name     TEXT NOT NULL,
    base_url         TEXT NOT NULL,
    added_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    added_by         UUID REFERENCES edge_user(user_id),
    last_push_at     TIMESTAMPTZ,
    last_push_status TEXT
);

CREATE INDEX idx_workflow_peer_added_at
    ON workflow_peer (added_at DESC);
