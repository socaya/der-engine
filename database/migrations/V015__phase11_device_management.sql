-- Phase 11 / der-1.2.0 (ADR-0019): edge device-client management.
--
-- Two tables. edge_device tracks each browser install (identity =
-- installation UUID generated client-side), edge_device_dependency
-- carries workflow-dependency intent that Initiative 3 (peer-to-peer)
-- and Initiative 10 slice B will act on. ADR-0019.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS edge_device (
    device_id             UUID PRIMARY KEY,
    assigned_user_id      UUID REFERENCES edge_user(user_id),
    enrolment_token_hash  TEXT,
    enrolled_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by           UUID REFERENCES edge_user(user_id),
    approved_at           TIMESTAMPTZ,
    last_seen_at          TIMESTAMPTZ,
    user_agent            TEXT,
    firmware_version      TEXT,
    status                TEXT NOT NULL CHECK (status IN
                               ('PENDING','APPROVED','SUSPENDED','REVOKED'))
                               DEFAULT 'PENDING'
);
CREATE INDEX IF NOT EXISTS ix_edge_device_status
    ON edge_device (status);
CREATE INDEX IF NOT EXISTS ix_edge_device_last_seen
    ON edge_device (last_seen_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS edge_device_dependency (
    device_id             UUID NOT NULL REFERENCES edge_device(device_id)
                                               ON DELETE CASCADE,
    depends_on_device_id  UUID NOT NULL REFERENCES edge_device(device_id)
                                               ON DELETE CASCADE,
    dependency_kind       TEXT NOT NULL CHECK (dependency_kind IN
                               ('APPROVES','FORWARDS','SUPERVISES')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, depends_on_device_id, dependency_kind),
    CHECK (device_id <> depends_on_device_id)
);
