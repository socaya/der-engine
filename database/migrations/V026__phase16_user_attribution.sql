-- V026 — ADR-0032 client-user attribution engine, initial schema.
--
-- One row per provisioned edge user mapping to a DHIS2 central user.
-- Resolved by the admin via GET /edge-api/v1/admin/users/{id}/dhis2-mapping.
-- Alpha.3 wires JournalPublisher to stamp storedBy from this mapping.

CREATE TABLE IF NOT EXISTS der.edge_user_dhis2_mapping (
    edge_user_id        UUID PRIMARY KEY REFERENCES der.edge_user(user_id) ON DELETE CASCADE,
    dhis2_user_uid      VARCHAR(11) NOT NULL,
    dhis2_username      TEXT NOT NULL,
    dhis2_display_name  TEXT,
    mapped_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    mapped_by           UUID NOT NULL REFERENCES der.edge_user(user_id) ON DELETE RESTRICT,
    last_verified_at    TIMESTAMPTZ,
    CONSTRAINT dhis2_user_uid_format CHECK (dhis2_user_uid ~ '^[A-Za-z][A-Za-z0-9]{10}$')
);

CREATE INDEX IF NOT EXISTS idx_edge_user_dhis2_mapping_uid
    ON der.edge_user_dhis2_mapping (dhis2_user_uid);

-- Journal-level attribution. captured_by_dhis2_uid is resolved at
-- enqueue time so historical replay preserves it even if the admin
-- later re-maps.
ALTER TABLE der.operation_journal
    ADD COLUMN IF NOT EXISTS captured_by_dhis2_uid VARCHAR(11);

CREATE INDEX IF NOT EXISTS idx_operation_journal_captured_by_dhis2
    ON der.operation_journal (captured_by_dhis2_uid)
    WHERE captured_by_dhis2_uid IS NOT NULL;

COMMENT ON TABLE der.edge_user_dhis2_mapping IS
    'ADR-0032: maps edge users to DHIS2 central user UIDs so captured data is attributed to the actual device user via storedBy on submission.';
