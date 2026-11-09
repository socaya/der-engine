-- DER Capture — composite-kind to DHIS2-metadata binding
-- (spec §3.2: "must remain DER-side structures unless a
-- separately configured and verified mapping into valid DHIS2
-- events/data elements/relationships exists"; §3.4 type
-- registry carries centralRelationshipTypeUid + syncPolicy).
--
-- A composite kind is not useful for capture until an admin
-- has bound it to DHIS2 metadata — specifically a program
-- stage for the head form fields and (optionally) a second
-- program stage for repeatable line items. The capture client
-- loads data-element definitions from those stages via the
-- metadata mirror and renders inputs accordingly; head_payload
-- + item_payload are then data_element_uid → value maps, same
-- shape as a tracker event's dataValues (so the DER_DOMAIN
-- composite can later export as a real event once the mapping
-- is verified).
--
-- Head + item stage UIDs are nullable — kinds without them are
-- "configuration incomplete" and the capture client disables
-- their "+ New …" action button. Admin UI shows which kinds
-- need wiring.

SET search_path = der, public;

ALTER TABLE der_domain_composite_kind
    ADD COLUMN IF NOT EXISTS head_program_stage_uid
        VARCHAR(11)
        REFERENCES metadata_program_stage(dhis2_uid)
        ON DELETE SET NULL;

ALTER TABLE der_domain_composite_kind
    ADD COLUMN IF NOT EXISTS item_program_stage_uid
        VARCHAR(11)
        REFERENCES metadata_program_stage(dhis2_uid)
        ON DELETE SET NULL;

/* syncPolicy per spec §3.4 — the admin flags whether a kind
 * has a verified central mapping (EXPORTABLE) or stays DER-only
 * (EDGE_ONLY). Default EDGE_ONLY matches the §3.2 guardrail. */
ALTER TABLE der_domain_composite_kind
    ADD COLUMN IF NOT EXISTS sync_policy TEXT
        NOT NULL DEFAULT 'EDGE_ONLY';

ALTER TABLE der_domain_composite_kind
    ADD CONSTRAINT der_domain_composite_kind_sync_policy_check
    CHECK (sync_policy IN ('EDGE_ONLY', 'EXPORTABLE'));

CREATE INDEX IF NOT EXISTS ix_domain_composite_kind_head_stage
    ON der_domain_composite_kind (head_program_stage_uid)
 WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_domain_composite_kind_item_stage
    ON der_domain_composite_kind (item_program_stage_uid)
 WHERE deleted_at IS NULL;
