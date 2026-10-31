-- V060: per-UID version history across snapshots.
--
-- Pilot snapshots pin to a snapshot_id, but the mirror's live tables
-- carry only the latest version of each row (ON CONFLICT DO UPDATE).
-- This history table captures one row per (snapshot_id, resource, uid)
-- plus a fingerprint, so we can answer:
--
--   diff(a, b) = {added:   {uid in b not in a},
--                 removed: {uid in a not in b},
--                 changed: {uid in both whose fingerprint differs}}
--
-- Rows are kept forever (DER's metadata is small; keeping history is
-- cheaper than re-fetching from DHIS2 for diff).

SET search_path = der, public;

CREATE TABLE metadata_entity_version (
    snapshot_id  BIGINT  NOT NULL
                 REFERENCES metadata_snapshot(snapshot_id) ON DELETE CASCADE,
    resource     TEXT    NOT NULL,
    dhis2_uid    TEXT    NOT NULL,
    fingerprint  TEXT    NOT NULL,
    PRIMARY KEY (snapshot_id, resource, dhis2_uid)
);

CREATE INDEX idx_metadata_entity_version_lookup
    ON metadata_entity_version (resource, dhis2_uid, snapshot_id DESC);
CREATE INDEX idx_metadata_entity_version_snapshot
    ON metadata_entity_version (snapshot_id, resource);
