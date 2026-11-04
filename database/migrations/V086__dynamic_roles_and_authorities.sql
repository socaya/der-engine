-- V086 — Dynamic role catalogue + per-role authority grants.
--
-- Moves role management from the fixed Phase 02 enum
-- (ADMIN/OPERATOR/REVIEWER/SYNC_WORKER) to a dynamic catalogue:
--   * role_definition          — one row per role name (built-in or custom)
--   * role_authority           — many-to-many: role_definition -> authority string
--   * edge_user_role_custom    — grants of custom (non-built-in) roles to users
--
-- The four built-in roles stay present (is_builtin = TRUE) and keep their
-- existing semantics: user grants of built-in roles continue to live in the
-- Phase 02 table `edge_role` so `hasRole('ADMIN')` enforcement is
-- unchanged.  Custom roles land in edge_user_role_custom and are observed
-- only through their mapped authorities (new `hasAuthority(...)` paths).
--
-- Authority strings follow the convention  der.<module>.<verb>   so they
-- group cleanly in the admin UI.

SET search_path = der, public;

-- ---------- role_definition ------------------------------------------------
CREATE TABLE IF NOT EXISTS role_definition (
    role_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    description  TEXT,
    is_builtin   BOOLEAN NOT NULL DEFAULT FALSE,
    builtin_key  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID REFERENCES edge_user(user_id),
    CONSTRAINT role_definition_name_nonempty CHECK (length(trim(name)) > 0),
    CONSTRAINT role_definition_builtin_key_valid
        CHECK (builtin_key IS NULL OR builtin_key IN ('ADMIN','OPERATOR','REVIEWER','SYNC_WORKER'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_role_definition_name ON role_definition (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS ux_role_definition_builtin_key
    ON role_definition (builtin_key) WHERE builtin_key IS NOT NULL;

-- ---------- role_authority -------------------------------------------------
CREATE TABLE IF NOT EXISTS role_authority (
    role_id    UUID NOT NULL REFERENCES role_definition(role_id) ON DELETE CASCADE,
    authority  TEXT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, authority),
    CONSTRAINT role_authority_prefix CHECK (authority LIKE 'der.%')
);

-- ---------- edge_user_role_custom -----------------------------------------
CREATE TABLE IF NOT EXISTS edge_user_role_custom (
    user_id    UUID NOT NULL REFERENCES edge_user(user_id) ON DELETE CASCADE,
    role_id    UUID NOT NULL REFERENCES role_definition(role_id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID REFERENCES edge_user(user_id),
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS ix_edge_user_role_custom_role
    ON edge_user_role_custom (role_id);

-- ---------- seed built-in roles -------------------------------------------
-- Idempotent: ON CONFLICT by the builtin_key unique index.
INSERT INTO role_definition (name, description, is_builtin, builtin_key) VALUES
    ('Administrator',
     'Full system administration. Can manage users, roles, DHIS2 wiring, '
     || 'synchronisation, drafts, conflicts, referrals, devices, network, '
     || 'workflows, backups and system settings.',
     TRUE, 'ADMIN'),
    ('Operator',
     'Day-to-day operator: runs syncs, publishes drafts, resolves conflicts, '
     || 'processes referrals, manages workflows.  Read access to configuration.',
     TRUE, 'OPERATOR'),
    ('Reviewer',
     'Read everything and approve drafts.  Cannot alter configuration or '
     || 'device enrolment.',
     TRUE, 'REVIEWER'),
    ('Sync worker',
     'Internal synchronisation worker.  Never grantable to interactive '
     || 'users (DER-ENG-001 §8.3).',
     TRUE, 'SYNC_WORKER')
ON CONFLICT (builtin_key) WHERE builtin_key IS NOT NULL DO NOTHING;

-- ---------- seed authorities per built-in --------------------------------
-- Admin: every authority DER currently exposes.
INSERT INTO role_authority (role_id, authority)
SELECT rd.role_id, a.authority
FROM role_definition rd
CROSS JOIN (VALUES
    ('der.users.read'),       ('der.users.write'),
    ('der.roles.read'),       ('der.roles.write'),
    ('der.dhis2.read'),       ('der.dhis2.write'),
    ('der.sync.read'),        ('der.sync.run'),
    ('der.drafts.read'),      ('der.drafts.publish'),
    ('der.conflicts.read'),   ('der.conflicts.resolve'),
    ('der.referrals.read'),   ('der.referrals.manage'),
    ('der.devices.read'),     ('der.devices.manage'),
    ('der.network.read'),     ('der.network.manage'),
    ('der.workflows.read'),   ('der.workflows.manage'),
    ('der.backup.read'),      ('der.backup.manage'),
    ('der.audit.read'),
    ('der.system.read'),      ('der.system.manage')
) AS a(authority)
WHERE rd.builtin_key = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Operator: run syncs, publish drafts, resolve conflicts, manage referrals /
-- workflows / devices read.  No roles.write, no system.manage, no backup.manage.
INSERT INTO role_authority (role_id, authority)
SELECT rd.role_id, a.authority
FROM role_definition rd
CROSS JOIN (VALUES
    ('der.users.read'),
    ('der.roles.read'),
    ('der.dhis2.read'),
    ('der.sync.read'),        ('der.sync.run'),
    ('der.drafts.read'),      ('der.drafts.publish'),
    ('der.conflicts.read'),   ('der.conflicts.resolve'),
    ('der.referrals.read'),   ('der.referrals.manage'),
    ('der.devices.read'),
    ('der.network.read'),
    ('der.workflows.read'),   ('der.workflows.manage'),
    ('der.backup.read'),
    ('der.audit.read'),
    ('der.system.read')
) AS a(authority)
WHERE rd.builtin_key = 'OPERATOR'
ON CONFLICT DO NOTHING;

-- Reviewer: read everything + publish drafts + resolve conflicts.  No run,
-- no manage, no write.
INSERT INTO role_authority (role_id, authority)
SELECT rd.role_id, a.authority
FROM role_definition rd
CROSS JOIN (VALUES
    ('der.users.read'),
    ('der.roles.read'),
    ('der.dhis2.read'),
    ('der.sync.read'),
    ('der.drafts.read'),      ('der.drafts.publish'),
    ('der.conflicts.read'),   ('der.conflicts.resolve'),
    ('der.referrals.read'),
    ('der.devices.read'),
    ('der.network.read'),
    ('der.workflows.read'),
    ('der.backup.read'),
    ('der.audit.read'),
    ('der.system.read')
) AS a(authority)
WHERE rd.builtin_key = 'REVIEWER'
ON CONFLICT DO NOTHING;

-- Sync worker: internal only.  Only the sync + dhis2 read surfaces + system
-- read.  Deliberately not surfaced in the admin UI role picker.
INSERT INTO role_authority (role_id, authority)
SELECT rd.role_id, a.authority
FROM role_definition rd
CROSS JOIN (VALUES
    ('der.dhis2.read'),
    ('der.sync.read'),        ('der.sync.run'),
    ('der.system.read')
) AS a(authority)
WHERE rd.builtin_key = 'SYNC_WORKER'
ON CONFLICT DO NOTHING;
