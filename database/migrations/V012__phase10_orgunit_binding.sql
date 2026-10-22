-- Phase 10 / der-1.1.0 (ADR-0015): edge-to-orgUnit binding.
--
-- Extends the V001 edge_node singleton with the DHIS2 orgUnit the edge
-- serves. Values are populated via EA-01 (admin picks from a tree
-- fetched from /api/organisationUnits). Server-side HandlerInterceptor
-- rejects writes whose orgUnit path is not under org_unit_path.

SET search_path = der, public;

ALTER TABLE edge_node
    ADD COLUMN IF NOT EXISTS org_unit_id TEXT;
ALTER TABLE edge_node
    ADD COLUMN IF NOT EXISTS org_unit_display_name TEXT;
ALTER TABLE edge_node
    ADD COLUMN IF NOT EXISTS org_unit_path TEXT;
ALTER TABLE edge_node
    ADD COLUMN IF NOT EXISTS org_unit_bound_at TIMESTAMPTZ;
ALTER TABLE edge_node
    ADD COLUMN IF NOT EXISTS org_unit_bound_by UUID REFERENCES edge_user(user_id);

-- Enforce that if a binding is set, every column is set together.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'edge_node_orgunit_consistent'
    ) THEN
        ALTER TABLE edge_node
            ADD CONSTRAINT edge_node_orgunit_consistent
            CHECK (
              (org_unit_id IS NULL AND org_unit_display_name IS NULL AND org_unit_path IS NULL AND org_unit_bound_at IS NULL)
              OR
              (org_unit_id IS NOT NULL AND org_unit_display_name IS NOT NULL AND org_unit_path IS NOT NULL AND org_unit_bound_at IS NOT NULL)
            );
    END IF;
END
$$;
