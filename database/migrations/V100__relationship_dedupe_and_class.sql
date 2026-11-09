-- DER Capture — Slice D.1 + D.2: relationship dedupe and class
-- separation (spec §REL-S-010 + §REL-S-011).
--
-- D.1 — Duplicate prevention:
--   Two devices (or an impatient operator double-clicking Save)
--   can otherwise race to create the same semantic link. Add a
--   unique partial index on (type, from, to) excluding soft-
--   deleted rows so a recreate after unlink is allowed but
--   concurrent creates of the same semantic link collide at
--   insert time. `bidirectional` is included because a type
--   can be recorded both-ways-then-swapped; the pair
--   (A → B, bidir=true) is the same link as (B → A, bidir=true)
--   but the server treats whichever side the operator picked
--   as canonical, so we don't collapse those cases at the DB
--   layer — the compose UI dedups client-side already.
--
-- D.2 — Relationship class:
--   Spec §3 distinguishes three sources:
--     DHIS2_NATIVE   — defined in central metadata, must sync
--     DER_DOMAIN     — DER-only workflow types (never leave edge)
--     DER_OPERATIONAL — DER-only diagnostic links (telemetry /
--                       workflow runs, never leave edge)
--   The drain will route only DHIS2_NATIVE to central (follow-up
--   commit). Add a rel_class column with CHECK + default so
--   existing rows backfill to DHIS2_NATIVE (safe — that's what
--   they all are today).

SET search_path = der, public;

-- D.1 — unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS ux_edge_relationship_semantic
    ON edge_tracker_relationship
       (relationship_type, from_entity_type, from_entity_uid,
        to_entity_type, to_entity_uid)
 WHERE deleted_at IS NULL;

-- D.2 — class column
ALTER TABLE edge_tracker_relationship
    ADD COLUMN IF NOT EXISTS rel_class TEXT NOT NULL
        DEFAULT 'DHIS2_NATIVE';

ALTER TABLE edge_tracker_relationship
    ADD CONSTRAINT edge_rel_class_check
    CHECK (rel_class IN
        ('DHIS2_NATIVE', 'DER_DOMAIN', 'DER_OPERATIONAL'));

-- Also classify the metadata mirror itself so admins can see
-- which types will cross the sync boundary vs stay on-edge.
ALTER TABLE metadata_relationship_type
    ADD COLUMN IF NOT EXISTS rel_class TEXT NOT NULL
        DEFAULT 'DHIS2_NATIVE';

ALTER TABLE metadata_relationship_type
    ADD CONSTRAINT metadata_rel_type_class_check
    CHECK (rel_class IN
        ('DHIS2_NATIVE', 'DER_DOMAIN', 'DER_OPERATIONAL'));

-- Index to support the "give me only DHIS2-native types" filter
-- the type picker uses when hiding DER-only types from the
-- sync-bound create path.
CREATE INDEX IF NOT EXISTS ix_metadata_rel_type_class
    ON metadata_relationship_type (rel_class);
