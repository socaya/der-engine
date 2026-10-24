-- der-2.0.5 — editable DHIS2 central connection + compatibility config.
--
-- A single-row store that lets ADMIN operators change the DHIS2 central
-- URL, credentials and compatibility policy at runtime without having to
-- restart the server. Secrets (password, PAT) travel through the shared
-- SecretEnvelope so they're AES-256-GCM encrypted at rest when
-- der.security.secret-key is set.
CREATE TABLE der.dhis2_connection_config (
    singleton                   boolean      NOT NULL DEFAULT true,
    base_url                    text,
    username                    text,
    password_sealed             text,
    pat_token_sealed            text,
    allow_mismatch              boolean      NOT NULL DEFAULT false,
    pinned_version              text,
    min_supported_version       text,
    max_tested_version          text,
    compat_mode                 text,
    snapshot_ttl_hours          integer,
    connect_timeout_millis      integer,
    proxy_enabled               boolean,
    proxy_allow_writes          boolean,
    proxy_allow_paths           text,
    updated_at                  timestamptz  NOT NULL DEFAULT now(),
    updated_by                  uuid,
    CONSTRAINT dhis2_connection_config_singleton CHECK (singleton = true),
    CONSTRAINT dhis2_connection_config_singleton_unique UNIQUE (singleton)
);

COMMENT ON TABLE  der.dhis2_connection_config IS 'der-2.0.5 editable DHIS2 central connection + compat policy; singleton row.';
COMMENT ON COLUMN der.dhis2_connection_config.password_sealed   IS 'SecretEnvelope-sealed service-account password; NULL when unset.';
COMMENT ON COLUMN der.dhis2_connection_config.pat_token_sealed  IS 'SecretEnvelope-sealed PAT; takes precedence over password when set.';
