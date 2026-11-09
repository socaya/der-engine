-- DER Capture — per-type custom actions on relationship types
-- (operator request: "obey the Relationship Type definitions"
-- for actions; follow-up to REL-C-017 admin aliases).
--
-- Admins register one or more custom actions per relationship
-- type that surface as items in the Capture app's row context
-- menu alongside the baked-in Open / Copy / Unlink actions. v1
-- supports URL-template actions that open an external URL in a
-- new tab with {targetUid}, {teiUid}, {relationshipUid} substitutable.
--
-- Shape: JSONB array like
--   [{"label": "View lab result",
--     "urlTemplate": "/apps/lab/results?eventUid={targetUid}"},
--    {"label": "Mark as received",
--     "urlTemplate": "/edge-api/v1/referrals/{targetUid}/receive"}]
--
-- Not touched by metadata sync (same approach as the alias
-- overrides): survives every sync pass.

SET search_path = der, public;

ALTER TABLE metadata_relationship_type
    ADD COLUMN IF NOT EXISTS admin_custom_actions JSONB;
