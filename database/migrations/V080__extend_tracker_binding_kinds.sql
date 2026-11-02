-- V080 — extend bound_metadata_kind to fully cover DHIS2 capture-form
-- metadata across aggregate, events, and tracker models.
--
-- Rationale §2.3.98 R-F/binding-kinds: a capture workflow may bind to
-- any DHIS2 capture-form object operators actually author against,
-- not just the four kinds V073 enumerated. The complete catalogue
-- lands here so operators can pin a workflow at the exact point a
-- facility registers it in DHIS2.
--
-- Aggregate side:
--   DATA_SET              — a dataset (as before).
--   DATA_SET_SECTION      — section within a dataset form.
--
-- Events + Tracker side:
--   PROGRAM               — a tracker or event-only program.
--   PROGRAM_SECTION       — enrolment-form attribute grouping on a
--                            tracker program (DHIS2 2.44 object).
--   PROGRAM_STAGE         — a stage within a tracker / event program.
--   PROGRAM_STAGE_SECTION — data-element section within a stage.
--   TRACKED_ENTITY_TYPE   — binds a workflow to a TE type regardless
--                            of program (e.g. "every patient
--                            registration" across programs).
--
-- Sentinel:
--   SYSTEM — the capture-wrap sentinel introduced in V073 for every
--            non-operator write path (ad-hoc writes, pulls, referral
--            ingest).

SET search_path = der, public;

ALTER TABLE capture_workflow
    DROP CONSTRAINT IF EXISTS capture_workflow_bound_metadata_kind_check;

ALTER TABLE capture_workflow
    ADD CONSTRAINT capture_workflow_bound_metadata_kind_check
        CHECK (bound_metadata_kind IN (
            -- Aggregate side.
            'DATA_SET',
            'DATA_SET_SECTION',
            'DATA_ELEMENT',
            -- Tracker + events side.
            'PROGRAM',
            'PROGRAM_SECTION',
            'PROGRAM_STAGE',
            'PROGRAM_STAGE_SECTION',
            'TRACKED_ENTITY_TYPE',
            'TRACKED_ENTITY_ATTRIBUTE',
            -- Server-managed capture-wrap sentinel.
            'SYSTEM'
        ));

COMMENT ON COLUMN capture_workflow.bound_metadata_kind IS
'DHIS2 metadata kind the workflow attaches to. V080 completes the '
'enum so capture workflows can bind at any level operators actually '
'author against — DATA_SET / DATA_SET_SECTION / DATA_ELEMENT on the '
'aggregate side; PROGRAM / PROGRAM_SECTION / PROGRAM_STAGE / '
'PROGRAM_STAGE_SECTION / TRACKED_ENTITY_TYPE / '
'TRACKED_ENTITY_ATTRIBUTE on the tracker side.';
