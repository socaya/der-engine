-- DER Capture — relationship-type mirror (relationships slice 1).
--
-- Round 1 of the full-emulation relationships work. Mirrors the
-- DHIS2 relationshipTypes collection into a structured table so
-- the Capture client can populate the type picker offline + query
-- "which relationship types are valid between TET X and TET Y"
-- without a round-trip to central.
--
-- relationshipTypes is already pulled into der.metadata_catalog as
-- raw payload JSON (catalog bucket), but that lives as a flat
-- (uid, displayName, JSONB) row — no structured access to the from/
-- to constraint UIDs. This structured table lives alongside it;
-- the catalog row stays for forward-compat.
--
-- DHIS2 constraint JSON shape per side:
--   { "relationshipEntity": "TRACKED_ENTITY_INSTANCE",
--     "trackedEntityType": { "id": "<TET uid>" } }   OR
--   { "relationshipEntity": "PROGRAM_INSTANCE",
--     "program": { "id": "<program uid>" } }         OR
--   { "relationshipEntity": "PROGRAM_STAGE_INSTANCE",
--     "programStage": { "id": "<stage uid>" } }
--
-- We flatten each side into kind + referenced UID columns so a
-- WHERE lookup is a simple equality check. The full constraint
-- JSON stays in payload for any attribute we don't flatten yet.
--
-- Round 2 adds relationship + relationship_item edge-write tables.
-- Round 3 adds controller + drain. Round 4 swaps the client's
-- direct central calls to edge routes.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS metadata_relationship_type (
    dhis2_uid TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    bidirectional BOOLEAN NOT NULL DEFAULT FALSE,
    /* "TRACKED_ENTITY_INSTANCE" | "PROGRAM_INSTANCE"
     *                           | "PROGRAM_STAGE_INSTANCE".
     * Nullable because malformed metadata could omit a side;
     * the client treats a null kind as "unusable" and skips it. */
    from_constraint_kind TEXT,
    from_constraint_uid TEXT,
    to_constraint_kind TEXT,
    to_constraint_uid TEXT,
    payload JSONB NOT NULL,
    snapshot_id BIGINT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS metadata_relationship_type_from_idx
    ON metadata_relationship_type (from_constraint_kind,
                                    from_constraint_uid);
CREATE INDEX IF NOT EXISTS metadata_relationship_type_to_idx
    ON metadata_relationship_type (to_constraint_kind,
                                    to_constraint_uid);
