-- V074 — require workflow_run_id on aggregate_data_value.
--
-- V073 seeded two SYSTEM workflow definitions and wired
-- DataValueSetsController + ReferralIngestService to attach every
-- write to one. The sister services (events, enrolment, TEI) still
-- write without a workflow run; this migration therefore scopes the
-- NOT NULL enforcement to aggregate only. Event / Enrolment / TEI
-- NOT NULL ships once R-C/2 and R-C/3 land.
--
-- operation_journal is left nullable because pre-R-C/1.3 entries
-- have no run id and we don't want to drop them (they encode
-- in-flight / terminal state for live writes). New rows go in with
-- workflow_run_id set.

SET search_path = der, public;

-- Backfill — any aggregate rows that slipped through between V072
-- (nullable add) and this one get retroactively attached to the
-- WEB_APP_CAPTURE system workflow. Business key is derived from the
-- row's own dataset/orgUnit/period/submitter so distinct scopes get
-- distinct runs.
--
-- The upsert on (workflow_id, workflow_version, business_key)
-- collapses parallel inserts for the same scope to a single run.
WITH want AS (
    SELECT av.value_id,
           av.data_set_uid || '|' || av.org_unit_uid || '|'
             || av.period_iso || '|' || av.submitted_by AS bk,
           av.submitted_by,
           av.submitted_at
    FROM aggregate_data_value av
    WHERE av.workflow_run_id IS NULL
),
ensured AS (
    INSERT INTO capture_workflow_run (
        run_id, workflow_id, workflow_version, business_key, state,
        created_at, updated_at, created_by
    )
    SELECT gen_random_uuid(),
           '00000000-0000-0000-0000-000000000001'::uuid,  -- WEB_APP_CAPTURE
           1, bk, 'OPEN', submitted_at, submitted_at, submitted_by
    FROM (SELECT DISTINCT bk, submitted_by, MIN(submitted_at) AS submitted_at
          FROM want GROUP BY bk, submitted_by) w
    ON CONFLICT (workflow_id, workflow_version, business_key)
    DO UPDATE SET updated_at = EXCLUDED.updated_at
    RETURNING run_id, business_key
)
UPDATE aggregate_data_value av
   SET workflow_run_id = e.run_id
  FROM want w
  JOIN ensured e ON e.business_key = w.bk
 WHERE av.value_id = w.value_id;

-- Enforce.
ALTER TABLE aggregate_data_value
    ALTER COLUMN workflow_run_id SET NOT NULL;
