-- V070 — require data_set_uid on every aggregate_data_value row.
--
-- V069 added the tag as nullable so pre-existing rows and ad-hoc
-- writes could coexist. Policy decision §2.3.84: every aggregate
-- value in DER MUST declare the dataSet it was captured through, so
-- facility-local analytics can roll up by dataset without
-- re-deriving the mapping at read time.
--
-- Migration steps:
--   1. Backfill rows that have no dataset tag by consulting the
--      metadata_data_set mirror. When exactly one dataset contains
--      the row's data_element_uid, apply it unambiguously.
--   2. DELETE any rows left untagged after backfill. These are
--      pre-feature leftovers (the DER edge pre-dates the policy)
--      and can be re-captured; preserving them would block the
--      NOT NULL constraint for everybody.
--   3. Enforce `NOT NULL` so the invariant is DB-level, not just
--      application-level.

SET search_path = der, public;

-- 1. Backfill from metadata mirror. We take the single-matching
--    dataset per row; rows whose dataElement lives in more than one
--    dataset are intentionally skipped (and dropped in step 2) so
--    we don't invent a tag we can't substantiate.
WITH candidate AS (
    SELECT av.value_id,
           ds.dhis2_uid AS ds_uid
    FROM aggregate_data_value av
    JOIN metadata_data_set ds
      ON EXISTS (
          SELECT 1
          FROM jsonb_array_elements(ds.payload->'dataSetElements') dse
          WHERE dse->'dataElement'->>'id' = av.data_element_uid
      )
    WHERE av.data_set_uid IS NULL
),
unambiguous AS (
    SELECT value_id, MIN(ds_uid) AS ds_uid
    FROM candidate
    GROUP BY value_id
    HAVING COUNT(DISTINCT ds_uid) = 1
)
UPDATE aggregate_data_value av
SET data_set_uid = u.ds_uid
FROM unambiguous u
WHERE av.value_id = u.value_id;

-- 2. Drop unresolvable rows. If anything was dropped the server log
--    will surface the count via the application once the new policy
--    is in effect; the SQL itself stays side-effect-visible to the
--    admin via `audit_log` only when the service does the deletion
--    — pre-migration cleanup here is intentionally silent.
DELETE FROM aggregate_data_value WHERE data_set_uid IS NULL;

-- 3. Enforce DB-level invariant.
ALTER TABLE aggregate_data_value
    ALTER COLUMN data_set_uid SET NOT NULL;
