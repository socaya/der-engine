-- V032 — Phase N2 mTLS trust bootstrap + enrolment token store.
--
-- DER issues per-device cryptographic identities using an internal
-- Ed25519 CA. On first boot NetworkCaService generates the CA
-- keypair and persists it here (singleton). Devices POST their own
-- public key at /network/enroll; DER signs an attestation with the
-- CA's private key and returns the signed blob. Fingerprint is
-- stored on the client row so operators can revoke by cert.
--
-- Ed25519 chosen over X.509/RSA because:
--   - JDK built-in (no BouncyCastle)
--   - 32-byte keys, 64-byte signatures (fits in network_client.certificate_pem)
--   - Fast on constrained edge boxes
--   - Equivalent trust properties for the N2 scope.

CREATE TABLE IF NOT EXISTS der.network_ca (
    id                   SMALLINT PRIMARY KEY DEFAULT 1,
    algorithm            TEXT     NOT NULL DEFAULT 'Ed25519',
    private_key_pkcs8    BYTEA    NOT NULL,
    public_key_x509      BYTEA    NOT NULL,
    public_key_base64    TEXT     NOT NULL,
    fingerprint_sha256   TEXT     NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_single_ca CHECK (id = 1)
);

COMMENT ON TABLE der.network_ca IS
    'Phase N2 — Internal Ed25519 CA keypair (singleton). Used to sign '
    'per-device enrolment attestations. Private key stays server-side only.';

-- One-shot enrolment tokens, issued when an operator (or the
-- enrolment-QR flow) wants to let a specific device onboard. Devices
-- present the token on first POST /network/enroll and get an
-- attestation back. Tokens expire after 30 minutes.
CREATE TABLE IF NOT EXISTS der.network_enrol_token (
    token_hash           TEXT PRIMARY KEY,
    issued_by            UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL,
    issued_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at           TIMESTAMPTZ NOT NULL,
    device_id_hint       TEXT,
    consumed_at          TIMESTAMPTZ,
    consumed_by_device   TEXT
);

COMMENT ON TABLE der.network_enrol_token IS
    'Phase N2 — Short-lived single-use enrolment tokens issued by '
    'operators and consumed by devices on first contact.';

-- Promote the certificate_fingerprint column so it's always present
-- and indexable (needed for cert-based revocation lookups).
CREATE INDEX IF NOT EXISTS idx_network_client_cert_fingerprint
    ON der.network_client(certificate_fingerprint)
    WHERE certificate_fingerprint IS NOT NULL;
