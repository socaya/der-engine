-- V079 — backfill operation_journal entries for pre-R-C/3.2 tracker rows.
--
-- §2.3.95 — R-C/3.2 wired tracker controllers to enqueue outbox
-- entries, but any tracker rows that already existed when 2.3.94
-- shipped stayed invisible to the sync worker and showed "Local
-- only" in the admin browse. This migration retroactively enqueues
-- them so they can be pushed to Central and surface sync state.
--
-- One PENDING row per orphaned local row, carrying:
--   • the entity-type-appropriate reference (teiUid / enrollmentUid /
--     eventUid)
--   • the workflow_run_id stamped on the local row (never null post-
--     V074/V076/V078; defensive COALESCE anyway)
--   • a payload shaped the same way the controller writes new rows
--     so the ReferralPayloadEncoder reshapes it for Central.
--
-- Idempotent: NOT EXISTS guard means re-running it against a DB
-- that already has journal entries skips those rows.

SET search_path = der, public;

-- 1. Tracked entities
INSERT INTO operation_journal (
    operation_id, entity_type, entity_ref, payload_json, state,
    attempt_count, submitted_by, created_at, updated_at,
    workflow_run_id
)
SELECT
    gen_random_uuid(),
    'TRACKED_ENTITY',
    t.tei_uid,
    jsonb_build_object(
        'teiUid',            t.tei_uid,
        'trackedEntityType', t.tracked_entity_type,
        'orgUnit',           t.org_unit_uid,
        'attributes',        t.attributes,
        'teiVersion',        t.tei_version
    ),
    'PENDING',
    0,
    t.created_by,
    now(),
    now(),
    t.workflow_run_id
FROM tracked_entity t
WHERE t.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM operation_journal oj
    WHERE oj.entity_type = 'TRACKED_ENTITY'
      AND oj.entity_ref  = t.tei_uid
  );

-- 2. Enrolments
INSERT INTO operation_journal (
    operation_id, entity_type, entity_ref, payload_json, state,
    attempt_count, submitted_by, created_at, updated_at,
    workflow_run_id
)
SELECT
    gen_random_uuid(),
    'ENROLLMENT',
    en.enrollment_uid,
    jsonb_build_object(
        'enrollmentUid',  en.enrollment_uid,
        'teiUid',         en.tei_uid,
        'program',        en.program_uid,
        'orgUnit',        en.org_unit_uid,
        'status',         en.status,
        'enrollmentDate', to_char(en.enrollment_date, 'YYYY-MM-DD')
    ) || CASE WHEN en.incident_date IS NULL THEN '{}'::jsonb
              ELSE jsonb_build_object('incidentDate',
                                          to_char(en.incident_date, 'YYYY-MM-DD'))
         END,
    'PENDING',
    0,
    en.created_by,
    now(),
    now(),
    en.workflow_run_id
FROM edge_enrollment en
WHERE NOT EXISTS (
    SELECT 1 FROM operation_journal oj
    WHERE oj.entity_type = 'ENROLLMENT'
      AND oj.entity_ref  = en.enrollment_uid
  );

-- 3. Tracker stage events
INSERT INTO operation_journal (
    operation_id, entity_type, entity_ref, payload_json, state,
    attempt_count, submitted_by, created_at, updated_at,
    workflow_run_id
)
SELECT
    gen_random_uuid(),
    'PROGRAM_STAGE_EVENT',
    ev.event_uid,
    jsonb_build_object(
        'eventUid',      ev.event_uid,
        'enrollmentUid', ev.enrollment_uid,
        'program',       ev.program_uid,
        'programStage',  ev.program_stage_uid,
        'orgUnit',       ev.org_unit_uid,
        'status',        ev.status,
        'occurredDate',  to_char(ev.occurred_date, 'YYYY-MM-DD'),
        'dataValues',    COALESCE(ev.data_values, '{}'::jsonb)
    ),
    'PENDING',
    0,
    ev.created_by,
    now(),
    now(),
    ev.workflow_run_id
FROM edge_tracker_event ev
WHERE NOT EXISTS (
    SELECT 1 FROM operation_journal oj
    WHERE oj.entity_type = 'PROGRAM_STAGE_EVENT'
      AND oj.entity_ref  = ev.event_uid
  );
