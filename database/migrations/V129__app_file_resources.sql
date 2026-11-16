-- V129 — DHIS2 /api/fileResources mirror.
--
-- DHIS2 custom apps (eregisters attachment upload, Capture
-- data-element FILE_RESOURCE values) POST multipart files here
-- and store the returned fileResource UID on the owning entity.
-- Reads are GET /api/fileResources/<uid> (metadata) and
-- GET /api/fileResources/<uid>/data (blob bytes).
--
-- One row per file, referenced by DHIS2 UID so central-sync can
-- stream the blob on drain. Keep the file_type domain narrow to
-- what DHIS2 custom apps actually send today.

CREATE TABLE IF NOT EXISTS der.app_file_resource (
    file_resource_uid   TEXT PRIMARY KEY,  -- DHIS2 11-char UID
    name                TEXT NOT NULL,
    content_type        TEXT NOT NULL,
    content_length      BIGINT NOT NULL CHECK (content_length >= 0),
    content_md5         TEXT,
    domain              TEXT NOT NULL DEFAULT 'DATA_VALUE'
        CHECK (domain IN ('DATA_VALUE', 'PUSH_ANALYSIS',
                          'DOCUMENT', 'MESSAGE_ATTACHMENT',
                          'USER_AVATAR', 'ICON')),
    storage_status      TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (storage_status IN ('NONE', 'PENDING',
                                   'STORED', 'FAILED')),
    bytes               BYTEA NOT NULL,
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_app_file_resource_created
    ON der.app_file_resource (created_at DESC);

COMMENT ON TABLE der.app_file_resource IS
    'DHIS2 /api/fileResources mirror — blob storage for custom '
    'app attachments. Shape mirrors DHIS2 central.';
