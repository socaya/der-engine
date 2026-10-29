-- V034 — DER-MSG v2: SSE push + E2E encryption + CRDT docs
-- + edge-to-edge forwarding (Phase N5 extensions).
--
-- Four features build on the v1 broker:
--   1. End-to-end encryption of direct-message payloads (X25519
--      ECDH + AES-GCM; server stores ciphertext only).
--   2. Device key registry so senders can look up a peer device's
--      X25519 pubkey without the server mediating trust.
--   3. CRDT-document type routed through the normal message bus;
--      the server just forwards ops, clients handle LWW merge.
--   4. Edge-to-edge message forwarding — channels prefixed
--      `edge:<edge-fingerprint>:<sub>` are relayed to that peer
--      edge over its WireGuard HTTPS tunnel.

-- 1. Per-device cryptographic key registry.
CREATE TABLE IF NOT EXISTS der.device_crypto_key (
    device_id                TEXT PRIMARY KEY,
    x25519_public_key_base64 TEXT NOT NULL,
    ed25519_public_key_base64 TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE der.device_crypto_key IS
    'Phase N5 — Per-device X25519 (encryption) + Ed25519 (signing) '
    'public keys. Senders fetch recipients key here before publishing '
    'an encrypted direct message.';

-- 2. Encryption columns on the existing message table. Encrypted
-- payloads are opaque base64 ciphertext; server never decrypts.
ALTER TABLE der.device_message
    ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS recipient_device_id TEXT,
    ADD COLUMN IF NOT EXISTS sender_ephemeral_pubkey TEXT,
    ADD COLUMN IF NOT EXISTS nonce TEXT;

COMMENT ON COLUMN der.device_message.encrypted IS
    'When TRUE, payload is X25519 + AES-GCM ciphertext; server never '
    'decrypts. Clients use sender_ephemeral_pubkey + their static '
    'X25519 secret key to derive the shared secret and decrypt.';

-- 3. CRDT document registry — tracks which documents exist on
-- the mesh so clients can enumerate + subscribe. Operations are
-- published through the normal messaging bus with messageType =
-- CRDT_OP, channel = crdt:<doc-id>.
CREATE TABLE IF NOT EXISTS der.crdt_document (
    doc_id       TEXT PRIMARY KEY,
    doc_type     TEXT NOT NULL,  -- LWW_MAP | OR_SET | COUNTER | …
    created_by   TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_op_at   TIMESTAMPTZ,
    op_count     BIGINT NOT NULL DEFAULT 0,
    description  TEXT
);

CREATE INDEX IF NOT EXISTS idx_crdt_document_last_op
    ON der.crdt_document(last_op_at DESC NULLS LAST);

COMMENT ON TABLE der.crdt_document IS
    'Phase N5 — CRDT document index. Operations are routed via '
    'messaging bus (channel=crdt:<doc-id>, messageType=CRDT_OP).';

-- 4. Edge forwarding audit — each attempt to relay a channel to
-- a peer edge records here so operators can diagnose forwarding
-- failures without digging in the main messaging log.
CREATE TABLE IF NOT EXISTS der.message_forward_log (
    forward_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id       UUID NOT NULL REFERENCES der.device_message(message_id) ON DELETE CASCADE,
    target_edge_id   TEXT NOT NULL,
    target_peer_id   UUID REFERENCES der.network_peer(id) ON DELETE SET NULL,
    outcome          TEXT NOT NULL,  -- SUCCESS | PEER_UNREACHABLE | HTTP_ERROR | NO_PEER
    http_status      INTEGER,
    attempted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason           TEXT
);

CREATE INDEX IF NOT EXISTS idx_message_forward_log_message
    ON der.message_forward_log(message_id);
CREATE INDEX IF NOT EXISTS idx_message_forward_log_attempted
    ON der.message_forward_log(attempted_at DESC);

COMMENT ON TABLE der.message_forward_log IS
    'Phase N5 — Edge-to-edge forwarding attempt log for channels '
    'prefixed edge:<fingerprint>:<sub>.';
