-- V035 — Peer lifecycle: discovery, invites, health, retry
-- (Phase N5 extensions).
--
-- Four tables + one column add:
--   1. peer_discovered    — mDNS-discovered candidate edges (not
--                            yet trusted; appear on the Peers page
--                            with Approve/Reject actions).
--   2. peer_invite_token  — operator-signed invite tokens so a
--                            remote edge can prove it was invited
--                            before joining the peer group.
--   3. peer_health_sample — scheduled probe results (/system/health
--                            every N seconds) with latency + uptime.
--   4. forward_retry      — exponential-backoff retry queue for
--                            failed edge-to-edge forwards.
--   + hop_count + visited_edges on device_message to prevent
--     relay loops across a multi-edge mesh.

CREATE TABLE IF NOT EXISTS der.peer_discovered (
    discovered_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id         TEXT NOT NULL,
    hostname        TEXT NOT NULL,
    endpoint        TEXT NOT NULL,
    service_type    TEXT NOT NULL,  -- _der-peer._tcp.local.
    announced_version TEXT,
    announced_edge_fingerprint TEXT,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed        BOOLEAN NOT NULL DEFAULT FALSE,  -- operator saw it
    approved_peer_id UUID REFERENCES der.network_peer(id) ON DELETE SET NULL,
    UNIQUE (node_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_peer_discovered_last_seen
    ON der.peer_discovered(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_discovered_reviewed
    ON der.peer_discovered(reviewed, last_seen_at DESC);

COMMENT ON TABLE der.peer_discovered IS
    'Phase N5 — mDNS-discovered peer candidates awaiting operator review.';

CREATE TABLE IF NOT EXISTS der.peer_invite_token (
    token_hash      TEXT PRIMARY KEY,
    issued_by       UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    note            TEXT,
    consumed_at     TIMESTAMPTZ,
    consumed_by_edge TEXT,
    consumed_by_peer_id UUID REFERENCES der.network_peer(id) ON DELETE SET NULL
);

COMMENT ON TABLE der.peer_invite_token IS
    'Phase N5 — Operator-issued one-shot invite tokens so a remote '
    'edge can prove it was invited before joining the peer group.';

CREATE TABLE IF NOT EXISTS der.peer_health_sample (
    sample_id       BIGSERIAL PRIMARY KEY,
    peer_id         UUID NOT NULL REFERENCES der.network_peer(id) ON DELETE CASCADE,
    sampled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    outcome         TEXT NOT NULL,  -- UP | DOWN | DEGRADED | TIMEOUT
    latency_ms      INTEGER,
    remote_version  TEXT,
    remote_uptime_s BIGINT,
    http_status     INTEGER,
    reason          TEXT
);

CREATE INDEX IF NOT EXISTS idx_peer_health_recent
    ON der.peer_health_sample(peer_id, sampled_at DESC);

COMMENT ON TABLE der.peer_health_sample IS
    'Phase N5 — Rolling peer-health history for uptime % calculations.';

CREATE TABLE IF NOT EXISTS der.forward_retry (
    retry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES der.device_message(message_id) ON DELETE CASCADE,
    target_edge_id  TEXT NOT NULL,
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL,
    last_attempt_at TIMESTAMPTZ,
    last_outcome    TEXT,
    last_reason     TEXT,
    give_up_after   INTEGER NOT NULL DEFAULT 10
);

CREATE INDEX IF NOT EXISTS idx_forward_retry_due
    ON der.forward_retry(next_attempt_at)
    WHERE attempt_count < give_up_after;

COMMENT ON TABLE der.forward_retry IS
    'Phase N5 — Exponential-backoff retry queue for failed edge forwards.';

-- Loop prevention: carry hop count + visited edges on every message
-- so a relayed message never bounces more than max_hops times.
ALTER TABLE der.device_message
    ADD COLUMN IF NOT EXISTS hop_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS visited_edges TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN der.device_message.hop_count IS
    'Phase N5 — Number of edges this message has already crossed.';
COMMENT ON COLUMN der.device_message.visited_edges IS
    'Phase N5 — Edge fingerprints the message has passed through.';
