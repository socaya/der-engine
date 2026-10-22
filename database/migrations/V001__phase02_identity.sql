-- DER coordination state — Phase 02 identity + authorisation foundation.
--
-- Supersedes the pre-Phase-02 illustrative schema. No DER database has been
-- migrated to production at this release, so V001 is replaced in-place.
-- Phase 04+ migrations (V002…) will introduce journal and conflict tables.

CREATE SCHEMA IF NOT EXISTS der;
SET search_path = der, public;

-- -------- edge_node ---------------------------------------------------------
-- Identity of THIS edge instance. Exactly one row exists; a CHECK constraint
-- enforces singleton semantics via a fixed boolean column.
CREATE TABLE IF NOT EXISTS edge_node (
    edge_id        UUID PRIMARY KEY,
    singleton      BOOLEAN NOT NULL DEFAULT TRUE,
    display_name   TEXT NOT NULL,
    site_name      TEXT NOT NULL,
    central_base_url TEXT,                        -- recorded in Phase 02; populated by provisioning
    provisioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT edge_node_singleton CHECK (singleton = TRUE),
    CONSTRAINT edge_node_display_name_nonempty CHECK (length(trim(display_name)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_edge_node_singleton ON edge_node (singleton);

-- -------- edge_configuration -----------------------------------------------
-- Key/value configuration owned by DER itself. Secret values live in
-- `secret_envelope` (opaque; Phase 06 wires an encryption-at-rest provider).
CREATE TABLE IF NOT EXISTS edge_configuration (
    key           TEXT PRIMARY KEY,
    value         TEXT NOT NULL,
    secret_envelope BYTEA,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    TEXT NOT NULL
);

-- -------- edge_user ---------------------------------------------------------
-- A DER-mirrored user. Source is DHIS2 (`origin='DHIS2'`) or the bootstrap
-- flow (`origin='BOOTSTRAP'`). `external_uid` is DHIS2's `id` field for mirror
-- rows, or NULL for bootstrap-only users.
--
-- `disabled` enforces the "deny" state during a central revocation window.
CREATE TABLE IF NOT EXISTS edge_user (
    user_id       UUID PRIMARY KEY,
    username      TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    origin        TEXT NOT NULL CHECK (origin IN ('DHIS2','BOOTSTRAP')),
    external_uid  TEXT,
    disabled      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT edge_user_username_lower CHECK (username = lower(username)),
    CONSTRAINT edge_user_username_nonempty CHECK (length(username) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_edge_user_username ON edge_user (username);
CREATE UNIQUE INDEX IF NOT EXISTS ux_edge_user_external_uid ON edge_user (external_uid) WHERE external_uid IS NOT NULL;

-- -------- edge_role ---------------------------------------------------------
-- Role grants (ADMIN, OPERATOR, REVIEWER, SYNC_WORKER). Deliberately
-- hand-rolled rather than a full RBAC graph; Phase 03+ can extend.
CREATE TABLE IF NOT EXISTS edge_role (
    user_id       UUID NOT NULL REFERENCES edge_user(user_id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK (role IN ('ADMIN','OPERATOR','REVIEWER','SYNC_WORKER')),
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by    UUID REFERENCES edge_user(user_id),
    PRIMARY KEY (user_id, role)
);

-- -------- edge_credential ---------------------------------------------------
-- Password verifier for the local user. One row per user. The algorithm field
-- identifies the hash scheme ('ARGON2ID' for Phase 02). Verifier is the
-- scheme-encoded output of Spring Security's Argon2PasswordEncoder.
--
-- Verifier version is recorded so re-hashing on login is possible later.
CREATE TABLE IF NOT EXISTS edge_credential (
    user_id         UUID PRIMARY KEY REFERENCES edge_user(user_id) ON DELETE CASCADE,
    algorithm       TEXT NOT NULL CHECK (algorithm IN ('ARGON2ID')),
    verifier        TEXT NOT NULL,
    verifier_version INT NOT NULL DEFAULT 1,
    rotated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    CONSTRAINT edge_credential_verifier_nonempty CHECK (length(verifier) > 0)
);

-- -------- edge_session ------------------------------------------------------
-- Opaque session tokens. The DER_SESSION cookie carries only the SHA-256 of
-- the token presented to the client (`token_hash`); the raw token value is
-- never persisted. Server rotates on every re-auth.
CREATE TABLE IF NOT EXISTS edge_session (
    session_id    UUID PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES edge_user(user_id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL,
    issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ,
    client_ip     INET,
    user_agent    TEXT,
    CONSTRAINT edge_session_expires_after_issue CHECK (expires_at > issued_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_edge_session_token_hash ON edge_session (token_hash);
CREATE INDEX IF NOT EXISTS ix_edge_session_user_expiry ON edge_session (user_id, expires_at);

-- -------- scope_assignment --------------------------------------------------
-- Effective scope of a mirrored user, imported from DHIS2 at provisioning
-- time. `scope_type` identifies the dimension (ORG_UNIT, PROGRAM, DATA_SET).
CREATE TABLE IF NOT EXISTS scope_assignment (
    assignment_id BIGSERIAL PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES edge_user(user_id) ON DELETE CASCADE,
    scope_type    TEXT NOT NULL CHECK (scope_type IN ('ORG_UNIT','PROGRAM','DATA_SET')),
    scope_ref     TEXT NOT NULL,
    include_descendants BOOLEAN NOT NULL DEFAULT FALSE,
    imported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, scope_type, scope_ref)
);

-- -------- security_audit ----------------------------------------------------
-- Append-only security audit log. One row per security-sensitive event:
-- sign-in success/failure, admin mutation, revocation reconciliation,
-- bootstrap provisioning, scope change. Writes are performed from the
-- AuditLogger service, never ad-hoc.
CREATE TABLE IF NOT EXISTS security_audit (
    audit_id      BIGSERIAL PRIMARY KEY,
    event_type    TEXT NOT NULL,
    actor_user_id UUID,                           -- NULL for anonymous events
    subject_user_id UUID,
    client_ip     INET,
    user_agent    TEXT,
    outcome       TEXT NOT NULL CHECK (outcome IN ('SUCCESS','DENIED','ERROR')),
    detail        JSONB NOT NULL DEFAULT '{}'::jsonb,
    observed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_security_audit_observed_at ON security_audit (observed_at DESC);
CREATE INDEX IF NOT EXISTS ix_security_audit_event_type ON security_audit (event_type, observed_at DESC);
