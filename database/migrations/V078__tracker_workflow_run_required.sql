-- V078 — seed TRACKER_CAPTURE system workflow + backfill tracker
-- edge_* rows + enforce NOT NULL on workflow_run_id.
--
-- §2.3.89 R-C/3 — tracker captures (TEIs, enrolments, tracker stage
-- events) now follow the aggregate / event pattern: every row
-- carries a workflow run id.

SET search_path = der, public;

-- 1. Seed the TRACKER_CAPTURE system workflow.
INSERT INTO capture_workflow (
    workflow_id, display_name, bound_metadata_kind, bound_metadata_id,
    enabled, version, kind, requires_approval, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000005'::uuid,
    'System · DHIS2 Tracker capture',
    'SYSTEM', 'TRACKER_CAPTURE',
    true, 1, 'SYSTEM', false, now(), now()
)
ON CONFLICT (workflow_id) DO NOTHING;

-- 2. Backfill tracked_entity (business key = _TEI_|orgUnit|createdBy
-- matching the pattern the TrackedEntityController uses so a
-- subsequent re-capture by the same operator shares the run).
WITH want AS (
    SELECT te.tei_uid,
           '_TEI_|' || te.org_unit_uid || '|' || COALESCE(te.created_by::text, '00000000-0000-0000-0000-000000000000') AS bk,
           te.created_by,
           te.created_at
    FROM tracked_entity te
    WHERE te.workflow_run_id IS NULL
      AND te.created_by IS NOT NULL
),
ensured AS (
    INSERT INTO capture_workflow_run (
        run_id, workflow_id, workflow_version, business_key, state,
        created_at, updated_at, created_by
    )
    SELECT gen_random_uuid(),
           '00000000-0000-0000-0000-000000000005'::uuid,
           1, bk, 'OPEN', created_at, created_at, created_by
    FROM (SELECT DISTINCT bk, created_by, MIN(created_at) AS created_at
          FROM want GROUP BY bk, created_by) w
    ON CONFLICT (workflow_id, workflow_version, business_key)
    DO UPDATE SET updated_at = EXCLUDED.updated_at
    RETURNING run_id, business_key
)
UPDATE tracked_entity te
   SET workflow_run_id = e.run_id
  FROM want w
  JOIN ensured e ON e.business_key = w.bk
 WHERE te.tei_uid = w.tei_uid;

-- Drop any tracked_entity rows with null created_by that would still
-- block NOT NULL (safety).
DELETE FROM tracked_entity WHERE workflow_run_id IS NULL;

ALTER TABLE tracked_entity
    ALTER COLUMN workflow_run_id SET NOT NULL;

-- 3. Backfill edge_enrollment (business key = program|orgUnit|createdBy).
WITH want AS (
    SELECT en.enrollment_uid,
           en.program_uid || '|' || en.org_unit_uid || '|' || en.created_by AS bk,
           en.created_by,
           en.created_at
    FROM edge_enrollment en
    WHERE en.workflow_run_id IS NULL
),
ensured AS (
    INSERT INTO capture_workflow_run (
        run_id, workflow_id, workflow_version, business_key, state,
        created_at, updated_at, created_by
    )
    SELECT gen_random_uuid(),
           '00000000-0000-0000-0000-000000000005'::uuid,
           1, bk, 'OPEN', created_at, created_at, created_by
    FROM (SELECT DISTINCT bk, created_by, MIN(created_at) AS created_at
          FROM want GROUP BY bk, created_by) w
    ON CONFLICT (workflow_id, workflow_version, business_key)
    DO UPDATE SET updated_at = EXCLUDED.updated_at
    RETURNING run_id, business_key
)
UPDATE edge_enrollment en
   SET workflow_run_id = e.run_id
  FROM want w
  JOIN ensured e ON e.business_key = w.bk
 WHERE en.enrollment_uid = w.enrollment_uid;

ALTER TABLE edge_enrollment
    ALTER COLUMN workflow_run_id SET NOT NULL;

-- 4. Backfill edge_tracker_event (same business key as enrolment).
WITH want AS (
    SELECT ev.event_uid,
           ev.program_uid || '|' || ev.org_unit_uid || '|' || ev.created_by AS bk,
           ev.created_by,
           ev.created_at
    FROM edge_tracker_event ev
    WHERE ev.workflow_run_id IS NULL
),
ensured AS (
    INSERT INTO capture_workflow_run (
        run_id, workflow_id, workflow_version, business_key, state,
        created_at, updated_at, created_by
    )
    SELECT gen_random_uuid(),
           '00000000-0000-0000-0000-000000000005'::uuid,
           1, bk, 'OPEN', created_at, created_at, created_by
    FROM (SELECT DISTINCT bk, created_by, MIN(created_at) AS created_at
          FROM want GROUP BY bk, created_by) w
    ON CONFLICT (workflow_id, workflow_version, business_key)
    DO UPDATE SET updated_at = EXCLUDED.updated_at
    RETURNING run_id, business_key
)
UPDATE edge_tracker_event ev
   SET workflow_run_id = e.run_id
  FROM want w
  JOIN ensured e ON e.business_key = w.bk
 WHERE ev.event_uid = w.event_uid;

ALTER TABLE edge_tracker_event
    ALTER COLUMN workflow_run_id SET NOT NULL;
