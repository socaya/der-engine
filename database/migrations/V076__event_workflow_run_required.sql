-- V076 — require workflow_run_id on event + seed EVENT_CAPTURE
-- system workflow.
--
-- §2.3.87 R-C/2 — events now follow the aggregate pattern: every
-- row carries workflow lineage via the capture workflow coordinator
-- or an auto-wrap system run for the DHIS2 Event / Tracker capture
-- app passthrough.
--
-- Backfill: any event row without a workflow_run_id (pre-R-C/2
-- captures) is attached to a per-(program, programStage, org_unit,
-- created_by) EVENT_CAPTURE system run. Then NOT NULL is enforced.
--
-- event_data_value is left alone — it's a child-table of event and
-- inherits lineage through the eventId FK.

SET search_path = der, public;

-- 1. Seed the EVENT_CAPTURE system workflow.
INSERT INTO capture_workflow (
    workflow_id, display_name, bound_metadata_kind, bound_metadata_id,
    enabled, version, kind, requires_approval, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000004'::uuid,
    'System · DHIS2 Event / Tracker capture',
    'SYSTEM', 'EVENT_CAPTURE',
    true, 1, 'SYSTEM', false, now(), now()
)
ON CONFLICT (workflow_id) DO NOTHING;

-- 2. Backfill untagged events.
WITH want AS (
    SELECT ev.event_id,
           ev.program_uid || '|' || ev.program_stage_uid || '|'
             || ev.org_unit_uid || '|' || ev.created_by AS bk,
           ev.created_by,
           ev.occurred_at
    FROM event ev
    WHERE ev.workflow_run_id IS NULL
),
ensured AS (
    INSERT INTO capture_workflow_run (
        run_id, workflow_id, workflow_version, business_key, state,
        created_at, updated_at, created_by
    )
    SELECT gen_random_uuid(),
           '00000000-0000-0000-0000-000000000004'::uuid,  -- EVENT_CAPTURE
           1, bk, 'OPEN', created_at, created_at, created_by
    FROM (SELECT DISTINCT bk, created_by, MIN(occurred_at) AS created_at
          FROM want GROUP BY bk, created_by) w
    ON CONFLICT (workflow_id, workflow_version, business_key)
    DO UPDATE SET updated_at = EXCLUDED.updated_at
    RETURNING run_id, business_key
)
UPDATE event ev
   SET workflow_run_id = e.run_id
  FROM want w
  JOIN ensured e ON e.business_key = w.bk
 WHERE ev.event_id = w.event_id;

-- 3. Enforce.
ALTER TABLE event
    ALTER COLUMN workflow_run_id SET NOT NULL;
