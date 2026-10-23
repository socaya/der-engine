-- Phase 15 / der-2.0.1-alpha.2 — FR-08-01..02 TEI capture surface.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS tracked_entity (
    tei_uid               TEXT PRIMARY KEY,
    tracked_entity_type   TEXT NOT NULL,
    org_unit_uid          TEXT NOT NULL,
    attributes            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by            UUID REFERENCES edge_user(user_id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    tei_version           INT NOT NULL DEFAULT 1 CHECK (tei_version >= 1)
);

-- FR-08-02: search by authorised indexed fields.
CREATE INDEX IF NOT EXISTS ix_tracked_entity_type_ou
    ON tracked_entity (tracked_entity_type, org_unit_uid);

-- Attribute-value GIN index enables jsonb containment search:
-- ...WHERE attributes @> '{"<attr-uid>":"<value>"}'.
CREATE INDEX IF NOT EXISTS ix_tracked_entity_attrs
    ON tracked_entity USING GIN (attributes);
