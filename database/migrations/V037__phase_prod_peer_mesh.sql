-- V037 — §1 Peer mesh maturity (production): adjacency graph for
-- multi-hop routing, Ed25519 invite signatures, CRDT vector clocks,
-- and WebRTC signalling bookkeeping.

-- 1. Peer-of-peer adjacency so edges can learn the mesh topology
-- and route through intermediate hops when a direct peer isn't
-- reachable but a transitive one is.
CREATE TABLE IF NOT EXISTS der.peer_adjacency (
    local_peer_id   UUID NOT NULL REFERENCES der.network_peer(id) ON DELETE CASCADE,
    reachable_edge  TEXT NOT NULL,          -- fingerprint of edge the local peer can see
    hops            INTEGER NOT NULL DEFAULT 1,
    announced_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (local_peer_id, reachable_edge)
);

CREATE INDEX IF NOT EXISTS idx_peer_adjacency_reachable
    ON der.peer_adjacency(reachable_edge);

COMMENT ON TABLE der.peer_adjacency IS
    '§1 — Mesh topology: each row says "peer P can reach edge E in H hops".';

-- 2. Signed invite upgrade — add Ed25519 signature + payload fields
-- so receivers can verify provenance without consulting the issuer.
ALTER TABLE der.peer_invite_token
    ADD COLUMN IF NOT EXISTS payload_base64  TEXT,
    ADD COLUMN IF NOT EXISTS signature_base64 TEXT,
    ADD COLUMN IF NOT EXISTS issuer_edge      TEXT;

-- 3. CRDT catch-up — track each document's vector clock so late
-- joiners can request a bounded delta instead of the full op log.
CREATE TABLE IF NOT EXISTS der.crdt_vector_clock (
    doc_id      TEXT NOT NULL REFERENCES der.crdt_document(doc_id) ON DELETE CASCADE,
    replica_id  TEXT NOT NULL,           -- edge fingerprint or device id
    counter     BIGINT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (doc_id, replica_id)
);

CREATE INDEX IF NOT EXISTS idx_crdt_vector_doc
    ON der.crdt_vector_clock(doc_id);

COMMENT ON TABLE der.crdt_vector_clock IS
    '§1 CRDT catch-up — per-document per-replica Lamport counter.';

-- 4. WebRTC signalling: SDP offer/answer + ICE candidate exchange
-- through DER as broker, so devices on the same LAN can then stream
-- data channels peer-to-peer without DER in the data path.
CREATE TABLE IF NOT EXISTS der.webrtc_session (
    session_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiator_device TEXT NOT NULL,
    responder_device TEXT NOT NULL,
    sdp_offer        TEXT,
    sdp_answer       TEXT,
    state            TEXT NOT NULL DEFAULT 'OFFERED',  -- OFFERED | ANSWERED | COMPLETED | FAILED
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ,
    kind             TEXT NOT NULL DEFAULT 'data'      -- data | audio | video | screen
);

CREATE INDEX IF NOT EXISTS idx_webrtc_session_responder
    ON der.webrtc_session(responder_device, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webrtc_session_initiator
    ON der.webrtc_session(initiator_device, created_at DESC);

CREATE TABLE IF NOT EXISTS der.webrtc_ice_candidate (
    candidate_id    BIGSERIAL PRIMARY KEY,
    session_id      UUID NOT NULL REFERENCES der.webrtc_session(session_id) ON DELETE CASCADE,
    from_device     TEXT NOT NULL,
    candidate_sdp   TEXT NOT NULL,
    sdp_mid         TEXT,
    sdp_m_line_index INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webrtc_ice_session
    ON der.webrtc_ice_candidate(session_id, created_at ASC);

COMMENT ON TABLE der.webrtc_session IS
    '§1 WebRTC signalling: SDP offer/answer broker. Media flows peer-to-peer.';
