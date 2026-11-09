-- DER Capture — relationship-type admin alias overrides
-- (spec §REL-C-017: SHALL support configurable reverse labels
-- and orientation-aware explanations).
--
-- Admins can override the directional labels (fromToName /
-- toFromName) that come from DHIS2 payload metadata without
-- round-tripping to central. Scenario: central ships a
-- compound type name ("HIV Pro - Mother / child relationship")
-- and the admin wants local operators to see "Baby" / "Mother".
-- Setting the admin override here surfaces that label in the
-- capture wizard + list views on this edge only.
--
-- Nullable so an unset override falls back transparently to the
-- payload-derived name (RelationshipTypeController coalesces at
-- read time). Metadata sync's upsert (upsertRelationshipTypes)
-- updates display_name + constraint columns + payload but does
-- NOT touch these two columns, so the override survives a
-- mirror refresh — exactly what we want.

SET search_path = der, public;

ALTER TABLE metadata_relationship_type
    ADD COLUMN IF NOT EXISTS admin_from_to_name TEXT;
ALTER TABLE metadata_relationship_type
    ADD COLUMN IF NOT EXISTS admin_to_from_name TEXT;
ALTER TABLE metadata_relationship_type
    ADD COLUMN IF NOT EXISTS admin_alias_updated_at TIMESTAMPTZ;
ALTER TABLE metadata_relationship_type
    ADD COLUMN IF NOT EXISTS admin_alias_updated_by UUID;
