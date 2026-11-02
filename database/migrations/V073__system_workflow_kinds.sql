-- V073 — distinguish operator-authored (USER) workflows from
-- server-managed (SYSTEM) ones, and seed the two well-known system
-- workflows that let every data-write carry workflow lineage even
-- when the write isn't operator-driven.
--
-- Rationale §2.3.85: every row in a DER data table must point at a
-- workflow run so admins can filter + report by run. The DHIS2 Data
-- Entry web app and the referral ingester are *not* operator-run
-- workflows — they're system paths. Rather than NULL them out, we
-- auto-wrap each write in a system workflow run so lineage is
-- uniform.

SET search_path = der, public;

-- 1. Extend capture_workflow with a kind tag.
ALTER TABLE capture_workflow
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'USER'
        CHECK (kind IN ('USER', 'SYSTEM'));

-- 1a. Extend bound_metadata_kind to accept SYSTEM entries. The
-- original check restricted it to DHIS2 metadata kinds; system
-- workflows don't bind to any DHIS2 object so they use the sentinel
-- bound_metadata_kind = 'SYSTEM' + bound_metadata_id = <scope name>.
ALTER TABLE capture_workflow
    DROP CONSTRAINT IF EXISTS capture_workflow_bound_metadata_kind_check;

ALTER TABLE capture_workflow
    ADD CONSTRAINT capture_workflow_bound_metadata_kind_check
        CHECK (bound_metadata_kind IN (
            'DATA_SET', 'PROGRAM', 'PROGRAM_STAGE', 'PROGRAM_STAGE_SECTION',
            'SYSTEM'
        ));

-- 2. Seed well-known system workflows. We use deterministic UUIDs
--    so the service layer can look them up by id instead of by
--    display_name (which admins could rename).
--
--    Seeding uses INSERT ... ON CONFLICT DO NOTHING so re-running
--    the migration against an already-seeded DB is a no-op.
--
--    bound_metadata_kind / bound_metadata_id are placeholders for
--    system flows; the SystemWorkflowService resolves the real
--    binding at run-creation time.

INSERT INTO capture_workflow (
    workflow_id, display_name, bound_metadata_kind, bound_metadata_id,
    enabled, version, kind, requires_approval, created_at, updated_at
)
VALUES
    (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'System · DHIS2 Data Entry capture',
        'SYSTEM', 'WEB_APP_CAPTURE',
        true, 1, 'SYSTEM', false, now(), now()
    ),
    (
        '00000000-0000-0000-0000-000000000002'::uuid,
        'System · Referral ingest',
        'SYSTEM', 'REFERRAL_INGEST',
        true, 1, 'SYSTEM', false, now(), now()
    )
ON CONFLICT (workflow_id) DO NOTHING;
