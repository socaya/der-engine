-- V088 — Per-user DHIS2 credentials on the mapping table.
--
-- ADR-0032 shipped the mapping record (edge user ↔ DHIS2 user).  V088
-- extends it with the service credential the DER data-push worker
-- uses when writing on behalf of that user:
--
--     * auth_type        TOKEN (PAT) or BASIC (password).  Per-mapping
--                        override of the system default (see
--                        admin_setting below).  Null = inherit default.
--     * credential_ciph  Secret sealed with SecretEnvelope (AES-256-GCM).
--                        Null = no credential stored yet; the mapping
--                        still works for attribution but the write
--                        worker falls back to the configured
--                        der.dhis2.service-account credential.
--     * credential_set_at + _by audit who last rotated the secret.
--
-- The system-wide default auth type lives as a row in der.admin_setting
-- under key 'dhis2.user_credentials.default_auth_type' (seeded here to
-- 'BASIC' to match the pre-V088 behaviour where only the global
-- der.dhis2.service-account password was in use).

SET search_path = der, public;

ALTER TABLE edge_user_dhis2_mapping
    ADD COLUMN IF NOT EXISTS auth_type TEXT
        CHECK (auth_type IS NULL OR auth_type IN ('TOKEN', 'BASIC')),
    ADD COLUMN IF NOT EXISTS credential_cipher TEXT,
    ADD COLUMN IF NOT EXISTS credential_set_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS credential_set_by UUID REFERENCES edge_user(user_id);

-- Seed the system-wide default.  Operators may edit this through the
-- admin settings endpoint later; the per-mapping auth_type always
-- wins when set.
INSERT INTO admin_setting (key, value, updated_at, updated_by)
VALUES ('dhis2.user_credentials.default_auth_type',
        '"BASIC"'::jsonb,
        now(),
        NULL)
ON CONFLICT (key) DO NOTHING;
