-- V087 — Re-seed role_authority against the finer AuthorityCatalog.
--
-- V086 seeded the four built-in roles with the coarse 25-authority
-- catalogue (der.users.read/write, der.sync.read/run, ...).  The
-- catalogue is now 55 authorities with distinct capabilities
-- (der.devices.approve/suspend/revoke, der.sync.metadata.run vs
-- .data.run, der.drafts.publish.own vs .any, etc.).
--
-- Approach:
--   1. Wipe role_authority rows for built-in roles (keep rows for
--      custom roles — operators may have authored them).
--   2. Insert the fresh built-in authority sets.
--
-- Custom roles are left alone; custom roles that referenced
-- der.*.write / der.*.manage strings that no longer exist in the
-- catalogue will fail validation on the next PUT via
-- AuthorityCatalog.validAuthorityStrings() — surfaced to the admin
-- UI's role-editor rather than silently misbehaving.

SET search_path = der, public;

-- Step 1 ------------------------------------------------------------
DELETE FROM role_authority
WHERE role_id IN (SELECT role_id FROM role_definition WHERE is_builtin = TRUE);

-- Step 2 ------------------------------------------------------------
-- ADMIN: everything the catalogue exposes.
INSERT INTO role_authority (role_id, authority)
SELECT rd.role_id, a.authority
FROM role_definition rd
CROSS JOIN (VALUES
    ('der.users.read'), ('der.users.create'), ('der.users.update'),
    ('der.users.disable'), ('der.users.mapping.write'), ('der.users.role.assign'),
    ('der.roles.read'), ('der.roles.write'),
    ('der.dhis2.read'), ('der.dhis2.connection.write'), ('der.dhis2.credentials.rotate'),
    ('der.sync.read'), ('der.sync.metadata.run'), ('der.sync.data.run'),
    ('der.sync.drift.resolve'), ('der.sync.schedule.write'),
    ('der.drafts.read'), ('der.drafts.publish.own'), ('der.drafts.publish.any'),
    ('der.drafts.schedule.write'),
    ('der.conflicts.read'), ('der.conflicts.resolve'), ('der.conflicts.bulk.resolve'),
    ('der.referrals.read'), ('der.referrals.accept'), ('der.referrals.dismiss'),
    ('der.referrals.escalate'),
    ('der.devices.read'), ('der.devices.approve'), ('der.devices.suspend'),
    ('der.devices.revoke'), ('der.devices.decommission'),
    ('der.network.read'), ('der.network.peer.write'), ('der.network.topology.write'),
    ('der.network.firewall.write'),
    ('der.workflows.read'), ('der.workflows.run.open'), ('der.workflows.run.contribute'),
    ('der.workflows.publish'), ('der.workflows.catalogue.write'),
    ('der.backup.read'), ('der.backup.trigger'), ('der.backup.download'),
    ('der.restore.execute'),
    ('der.audit.read'), ('der.audit.export'),
    ('der.compliance.read'), ('der.compliance.manage'),
    ('der.system.read'), ('der.system.settings.write'), ('der.system.analytics.refresh'),
    ('der.system.hardware.write'), ('der.system.vault.read'), ('der.system.testing.run'),
    ('der.system.decommission')
) AS a(authority)
WHERE rd.builtin_key = 'ADMIN'
ON CONFLICT DO NOTHING;

-- OPERATOR: day-to-day field operator.
--   * all read authorities
--   * can trigger metadata + data syncs
--   * can publish own drafts (not any)
--   * can resolve individual conflicts (not bulk)
--   * can accept + dismiss + escalate referrals
--   * can run workflow steps (open, contribute, publish own run output)
--   * can trigger backups (but not download or restore)
--   * no user / role / dhis2 / device-lifecycle / network / system writes
INSERT INTO role_authority (role_id, authority)
SELECT rd.role_id, a.authority
FROM role_definition rd
CROSS JOIN (VALUES
    ('der.users.read'),
    ('der.roles.read'),
    ('der.dhis2.read'),
    ('der.sync.read'), ('der.sync.metadata.run'), ('der.sync.data.run'),
    ('der.drafts.read'), ('der.drafts.publish.own'),
    ('der.conflicts.read'), ('der.conflicts.resolve'),
    ('der.referrals.read'), ('der.referrals.accept'),
    ('der.referrals.dismiss'), ('der.referrals.escalate'),
    ('der.devices.read'),
    ('der.network.read'),
    ('der.workflows.read'), ('der.workflows.run.open'),
    ('der.workflows.run.contribute'), ('der.workflows.publish'),
    ('der.backup.read'), ('der.backup.trigger'),
    ('der.audit.read'),
    ('der.compliance.read'),
    ('der.system.read')
) AS a(authority)
WHERE rd.builtin_key = 'OPERATOR'
ON CONFLICT DO NOTHING;

-- REVIEWER: approves + resolves + reads.  No run, no write.
--   * all read authorities
--   * can publish ANY user's drafts (reviewer approval path)
--   * can resolve single + bulk conflicts
--   * can escalate referrals (routing decision)
--   * can export the audit stream (part of their evidence job)
INSERT INTO role_authority (role_id, authority)
SELECT rd.role_id, a.authority
FROM role_definition rd
CROSS JOIN (VALUES
    ('der.users.read'),
    ('der.roles.read'),
    ('der.dhis2.read'),
    ('der.sync.read'),
    ('der.drafts.read'), ('der.drafts.publish.any'),
    ('der.conflicts.read'), ('der.conflicts.resolve'), ('der.conflicts.bulk.resolve'),
    ('der.referrals.read'), ('der.referrals.escalate'),
    ('der.devices.read'),
    ('der.network.read'),
    ('der.workflows.read'),
    ('der.backup.read'),
    ('der.audit.read'), ('der.audit.export'),
    ('der.compliance.read'),
    ('der.system.read')
) AS a(authority)
WHERE rd.builtin_key = 'REVIEWER'
ON CONFLICT DO NOTHING;

-- SYNC_WORKER: internal only — minimal surface so the sync worker
-- can reach its own endpoints over its service credential.
INSERT INTO role_authority (role_id, authority)
SELECT rd.role_id, a.authority
FROM role_definition rd
CROSS JOIN (VALUES
    ('der.dhis2.read'),
    ('der.sync.read'), ('der.sync.metadata.run'), ('der.sync.data.run'),
    ('der.system.read')
) AS a(authority)
WHERE rd.builtin_key = 'SYNC_WORKER'
ON CONFLICT DO NOTHING;
