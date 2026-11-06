-- V089 — ADR-0036: seed der.capture.read authority for the Data-module
-- capture form API (GET /edge-api/v1/capture/**).
--
-- The authority gates every read on the new form-assembly endpoints
-- (run-scoped + free-standing). It is granted to every built-in role
-- on upgrade; operators who maintain custom roles grant it via the
-- admin-ui Roles screen after the migration runs.
--
-- Rationale for granting it to SYNC_WORKER too: the capture API reads
-- the same mirror tables the sync worker already touches on the write
-- path, so the service credential retains symmetric read coverage.
-- Per-OU scoping remains deferred to the broader permission-policy
-- initiative.

SET search_path = der, public;

INSERT INTO role_authority (role_id, authority)
SELECT rd.role_id, 'der.capture.read'
FROM role_definition rd
WHERE rd.builtin_key IN ('ADMIN', 'OPERATOR', 'REVIEWER', 'SYNC_WORKER')
ON CONFLICT DO NOTHING;
