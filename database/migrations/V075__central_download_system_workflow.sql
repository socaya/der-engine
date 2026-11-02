-- V075 — seed CENTRAL_DOWNLOAD system workflow.
--
-- §2.3.86 — facilities going fully local-first want to pull their
-- historical / existing aggregate values down from Central DHIS2
-- into DER's local store so operators capture against the real
-- running totals. Each pull operation gets its own run, tagged
-- here, so admins can see "run X downloaded N values on <date>".

SET search_path = der, public;

INSERT INTO capture_workflow (
    workflow_id, display_name, bound_metadata_kind, bound_metadata_id,
    enabled, version, kind, requires_approval, created_at, updated_at
)
VALUES
    (
        '00000000-0000-0000-0000-000000000003'::uuid,
        'System · Central DHIS2 download',
        'SYSTEM', 'CENTRAL_DOWNLOAD',
        true, 1, 'SYSTEM', false, now(), now()
    )
ON CONFLICT (workflow_id) DO NOTHING;
