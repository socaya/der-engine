-- V091 — app bundle signing + versioning.
--
-- Sibling of V007 installed_app.  Adds:
--
--   * signing_key: singleton row carrying the DER edge's Ed25519 key pair.
--     Private key is PKCS#8-encoded + SecretEnvelope-sealed. Public key is
--     stored raw (32 bytes, base64) so the device-side Web Crypto
--     subtle.importKey("raw", …, "Ed25519", …) call matches without JWK
--     gymnastics.  Generated lazily by AppSigningKeyService on first boot.
--
--   * installed_app_version: one row per uploaded bundle. bundle_bytes is
--     the raw JS blob; signature_b64 is the Ed25519 signature over the
--     exact bytes served.  superseded_at = NULL marks the active version;
--     the partial index below keeps the common lookup (active version for
--     an app) on the hot path.
--
-- Keep V007 as-is: only enabled/manifest live there; versioning + signing
-- are new sibling concerns and own their own table.
SET search_path = der, public;

CREATE TABLE IF NOT EXISTS signing_key (
    id             INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    algorithm      TEXT NOT NULL,       -- 'Ed25519'
    public_key_b64 TEXT NOT NULL,       -- raw public key, base64
    sealed_secret  TEXT NOT NULL,       -- SecretEnvelope-sealed PKCS#8 private key, base64
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by     UUID
);

CREATE TABLE IF NOT EXISTS installed_app_version (
    version_id       UUID PRIMARY KEY,
    app_id           UUID NOT NULL REFERENCES installed_app(app_id) ON DELETE CASCADE,
    version          TEXT NOT NULL,
    bundle_bytes     BYTEA NOT NULL,
    bundle_sha256    TEXT NOT NULL,
    signature_b64    TEXT NOT NULL,     -- Ed25519 signature over bundle_bytes
    requires_der_api TEXT NOT NULL,     -- semver
    uploaded_by      UUID,
    uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_at    TIMESTAMPTZ,       -- NULL == currently-active version
    UNIQUE (app_id, version)
);

CREATE INDEX IF NOT EXISTS ix_installed_app_version_active
    ON installed_app_version (app_id) WHERE superseded_at IS NULL;
