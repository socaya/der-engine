# DER role-capability matrix

**Source of truth:** `server/src/main/java/ug/ac/mak/der/security/AuthorityCatalog.java`
plus the seed in the latest `database/migrations/V08*_*role_authorit*.sql`
migration. This document reflects the state after V087 (fine-grained
authority split).

## 1. Model

- **Authorities** are fine-grained capability strings prefixed `der.<module>.<verb>`.
  They are the thing path gates check (`.hasAuthority("der.xxx")` in
  `SecurityConfig` and the per-controller `requireAdmin()` helpers).
- **Roles** are named bundles of authorities (`role_definition` table +
  `role_authority` link table). The system ships four **built-in** roles
  — `ADMIN`, `OPERATOR`, `REVIEWER`, `SYNC_WORKER` — that cannot be
  renamed or deleted but whose authority sets can be edited. Admins
  create **custom** roles with any mix of catalogue authorities.
- **Grants** — each user may hold any number of role grants:
  - Built-in role grants land in `edge_role` (Phase 02 table) and also
    issue a Spring `ROLE_<NAME>` for the legacy `.hasRole(..)` paths.
  - Custom role grants land in `edge_user_role_custom`.
  - At sign-in, `SessionCookieAuthenticationFilter` unions the
    authority set from every role grant and attaches it to the
    `EdgeUserPrincipal`.

Any role (built-in or custom) can hold any authority — custom-role
grants of the four ADMIN-only authorities below mean a custom role
can be as powerful as ADMIN, or a stripped-down slice of it.

## 2. Full authority catalogue (55 authorities)

Grouped by module. Add new rows in `AuthorityCatalog.java` + a seed
migration, not here directly — this file follows the enum.

### Users (6)

| Authority | Description |
|---|---|
| `der.users.read` | View users and their mappings |
| `der.users.create` | Provision new users |
| `der.users.update` | Edit user profile + display name |
| `der.users.disable` | Disable (or re-enable) a user |
| `der.users.mapping.write` | Edit the edge-user ↔ DHIS2-user mapping |
| `der.users.role.assign` | Assign or revoke roles on a user |

### Roles (2)

| Authority | Description |
|---|---|
| `der.roles.read` | View the role catalogue |
| `der.roles.write` | Create, edit and delete roles |

### DHIS2 wiring (3)

| Authority | Description |
|---|---|
| `der.dhis2.read` | View DHIS2 wiring and metadata |
| `der.dhis2.connection.write` | Edit DHIS2 base URL + version pins |
| `der.dhis2.credentials.rotate` | Rotate the DHIS2 service credential |

### Sync (5)

| Authority | Description |
|---|---|
| `der.sync.read` | View sync jobs, snapshots and drift |
| `der.sync.metadata.run` | Trigger a metadata sync |
| `der.sync.data.run` | Trigger an inbound data pull |
| `der.sync.drift.resolve` | Resolve metadata drift findings |
| `der.sync.schedule.write` | Edit the sync schedule / cron |

### Drafts (4)

| Authority | Description |
|---|---|
| `der.drafts.read` | View drafts |
| `der.drafts.publish.own` | Publish one's own drafts |
| `der.drafts.publish.any` | Publish any user's drafts (reviewer approval) |
| `der.drafts.schedule.write` | Schedule a draft for future publication |

### Conflicts (3)

| Authority | Description |
|---|---|
| `der.conflicts.read` | View the conflict queue |
| `der.conflicts.resolve` | Resolve a single conflict |
| `der.conflicts.bulk.resolve` | Bulk-resolve a filtered conflict set |

### Referrals (4)

| Authority | Description |
|---|---|
| `der.referrals.read` | View referrals |
| `der.referrals.accept` | Accept an inbound referral |
| `der.referrals.dismiss` | Dismiss an inbound referral |
| `der.referrals.escalate` | Escalate an unanswered referral (routing decision) |

### Devices (5)

| Authority | Description |
|---|---|
| `der.devices.read` | View the device fleet |
| `der.devices.approve` | Approve a pending enrolment |
| `der.devices.suspend` | Suspend an approved device |
| `der.devices.revoke` | Revoke a device (permanent) |
| `der.devices.decommission` | Delete a device + its history |

### Network (4)

| Authority | Description |
|---|---|
| `der.network.read` | View network topology and peers |
| `der.network.peer.write` | Edit peer definitions and adjacency |
| `der.network.topology.write` | Edit routing + topology |
| `der.network.firewall.write` | Edit firewall + lease rules |

### Workflows — capture workflows (5)

| Authority | Description |
|---|---|
| `der.workflows.read` | View capture workflows + activity feed |
| `der.workflows.run.open` | Open a workflow run |
| `der.workflows.run.contribute` | Contribute to a workflow run |
| `der.workflows.publish` | Publish a workflow run's output |
| `der.workflows.catalogue.write` | Edit the workflow catalogue |

### Backup + restore (4)

| Authority | Description |
|---|---|
| `der.backup.read` | View backup runs |
| `der.backup.trigger` | Trigger a backup |
| `der.backup.download` | Download a backup artefact |
| `der.restore.execute` | Execute a restore |

### Audit (2)

| Authority | Description |
|---|---|
| `der.audit.read` | View the security audit stream |
| `der.audit.export` | Export the audit stream to file |

### Compliance (2)

| Authority | Description |
|---|---|
| `der.compliance.read` | View compliance posture |
| `der.compliance.manage` | Run retention / erasure / audit-export jobs |

### System (7)

| Authority | Description |
|---|---|
| `der.system.read` | View diagnostics + settings |
| `der.system.settings.write` | Edit settings + feature flags + org-unit binding |
| `der.system.analytics.refresh` | Refresh analytics materialised views |
| `der.system.hardware.write` | Write to hardware (LEDs, fan, etc.) |
| `der.system.vault.read` | Read the security-hardening vault |
| `der.system.testing.run` | Run chaos / fault-injection harness |
| `der.system.decommission` | Decommission the edge (irreversible) |

## 3. Built-in roles → authority grants

Seeded by V086 + V087. Edits persist through the admin UI but are
reset to the seeded set by any future seed migration.

Legend: ✅ granted · · not granted

### Users / Roles / DHIS2

| Authority | ADMIN | OPERATOR | REVIEWER | SYNC_WORKER |
|---|:---:|:---:|:---:|:---:|
| `der.users.read` | ✅ | ✅ | ✅ | · |
| `der.users.create` | ✅ | · | · | · |
| `der.users.update` | ✅ | · | · | · |
| `der.users.disable` | ✅ | · | · | · |
| `der.users.mapping.write` | ✅ | · | · | · |
| `der.users.role.assign` | ✅ | · | · | · |
| `der.roles.read` | ✅ | ✅ | ✅ | · |
| `der.roles.write` | ✅ | · | · | · |
| `der.dhis2.read` | ✅ | ✅ | ✅ | ✅ |
| `der.dhis2.connection.write` | ✅ | · | · | · |
| `der.dhis2.credentials.rotate` | ✅ | · | · | · |

### Sync / Drafts / Conflicts

| Authority | ADMIN | OPERATOR | REVIEWER | SYNC_WORKER |
|---|:---:|:---:|:---:|:---:|
| `der.sync.read` | ✅ | ✅ | ✅ | ✅ |
| `der.sync.metadata.run` | ✅ | ✅ | · | ✅ |
| `der.sync.data.run` | ✅ | ✅ | · | ✅ |
| `der.sync.drift.resolve` | ✅ | · | · | · |
| `der.sync.schedule.write` | ✅ | · | · | · |
| `der.drafts.read` | ✅ | ✅ | ✅ | · |
| `der.drafts.publish.own` | ✅ | ✅ | · | · |
| `der.drafts.publish.any` | ✅ | · | ✅ | · |
| `der.drafts.schedule.write` | ✅ | · | · | · |
| `der.conflicts.read` | ✅ | ✅ | ✅ | · |
| `der.conflicts.resolve` | ✅ | ✅ | ✅ | · |
| `der.conflicts.bulk.resolve` | ✅ | · | ✅ | · |

### Referrals / Devices / Network

| Authority | ADMIN | OPERATOR | REVIEWER | SYNC_WORKER |
|---|:---:|:---:|:---:|:---:|
| `der.referrals.read` | ✅ | ✅ | ✅ | · |
| `der.referrals.accept` | ✅ | ✅ | · | · |
| `der.referrals.dismiss` | ✅ | ✅ | · | · |
| `der.referrals.escalate` | ✅ | ✅ | ✅ | · |
| `der.devices.read` | ✅ | ✅ | ✅ | · |
| `der.devices.approve` | ✅ | · | · | · |
| `der.devices.suspend` | ✅ | · | · | · |
| `der.devices.revoke` | ✅ | · | · | · |
| `der.devices.decommission` | ✅ | · | · | · |
| `der.network.read` | ✅ | ✅ | ✅ | · |
| `der.network.peer.write` | ✅ | · | · | · |
| `der.network.topology.write` | ✅ | · | · | · |
| `der.network.firewall.write` | ✅ | · | · | · |

### Workflows / Backup / Audit

| Authority | ADMIN | OPERATOR | REVIEWER | SYNC_WORKER |
|---|:---:|:---:|:---:|:---:|
| `der.workflows.read` | ✅ | ✅ | ✅ | · |
| `der.workflows.run.open` | ✅ | ✅ | · | · |
| `der.workflows.run.contribute` | ✅ | ✅ | · | · |
| `der.workflows.publish` | ✅ | ✅ | · | · |
| `der.workflows.catalogue.write` | ✅ | · | · | · |
| `der.backup.read` | ✅ | ✅ | ✅ | · |
| `der.backup.trigger` | ✅ | ✅ | · | · |
| `der.backup.download` | ✅ | · | · | · |
| `der.restore.execute` | ✅ | · | · | · |
| `der.audit.read` | ✅ | ✅ | ✅ | · |
| `der.audit.export` | ✅ | · | ✅ | · |

### Compliance / System

| Authority | ADMIN | OPERATOR | REVIEWER | SYNC_WORKER |
|---|:---:|:---:|:---:|:---:|
| `der.compliance.read` | ✅ | ✅ | ✅ | · |
| `der.compliance.manage` | ✅ | · | · | · |
| `der.system.read` | ✅ | ✅ | ✅ | ✅ |
| `der.system.settings.write` | ✅ | · | · | · |
| `der.system.analytics.refresh` | ✅ | · | · | · |
| `der.system.hardware.write` | ✅ | · | · | · |
| `der.system.vault.read` | ✅ | · | · | · |
| `der.system.testing.run` | ✅ | · | · | · |
| `der.system.decommission` | ✅ | · | · | · |

**Totals** — ADMIN: 55 authorities. OPERATOR: 25. REVIEWER: 19.
SYNC_WORKER: 5.

## 4. Path → authority (SecurityConfig)

### Public (no auth)

| Method | Path |
|---|---|
| ANY | `/admin/**`, `/favicon.ico`, `/favicon.svg`, `/error` |
| GET | `/edge-api/v1/system/health`, `/edge-api/v1/system/hardware/leds` |
| GET | `/actuator/health`, `/actuator/info`, `/actuator/prometheus` |
| POST | `/edge-api/v1/auth/sign-in` |
| POST | `/edge-api/v1/peer-lifecycle/invites/redeem` |
| POST | `/edge-api/v1/peer-mesh/adjacency`, `/edge-api/v1/messaging/relay` |

### Any authenticated user

Default behaviour for anything not matched by a more specific rule
below. Includes `/edge-api/v1/dhis2/ping`, operator queue, apps,
peer-mesh, webrtc, fleet, user-prefs, packaging, messaging,
compliance reads, `/api/**`, `/dhis-web-**/**`, tracked-entities,
aggregate completion, data-pull cursors, draft publish-own (the
owner check is in the controller), referral ack, workflow run
operations, admin metrics.

### Authority-gated

| Method | Path | Authority |
|---|---|---|
| GET | `/actuator/metrics` | `der.system.read` |
| ANY | `/edge-api/v1/dhis2/**` | `der.dhis2.connection.write` |
| ANY | `/edge-api/v1/provisioning/**` | `der.users.create` |
| ANY | `/edge-api/v1/sync/metadata/**` | `der.sync.metadata.run` |
| ANY | `/edge-api/v1/sync/data/**` | `der.sync.data.run` |
| ANY | `/edge-api/v1/sync/drift/**` | `der.sync.drift.resolve` |
| ANY | `/edge-api/v1/sync/**` (catch-all) | `der.sync.read` |
| ANY | `/edge-api/v1/backup/**` | `der.backup.trigger` |
| ANY | `/edge-api/v1/restore/**` | `der.restore.execute` |
| POST | `/edge-api/v1/system/org-unit` | `der.system.settings.write` |
| POST | `/edge-api/v1/approvals/**` | `der.drafts.publish.any` |
| GET | `/edge-api/v1/workflows/metrics`, `activity/**` | `der.workflows.read` |
| P/P/D | `/edge-api/v1/workflows/**` (catalogue) | `der.workflows.catalogue.write` |
| POST | `/edge-api/v1/devices/*/approve` | `der.devices.approve` |
| POST | `/edge-api/v1/devices/*/suspend` | `der.devices.suspend` |
| POST | `/edge-api/v1/devices/*/revoke` | `der.devices.revoke` |
| DELETE | `/edge-api/v1/devices/**` | `der.devices.decommission` |
| POST | `/edge-api/v1/analytics/refresh` | `der.system.analytics.refresh` |
| GET | `/edge-api/v1/security/audit/verify` | `der.audit.read` |
| POST | `/edge-api/v1/journal/*/next-hop` | `der.referrals.escalate` |
| ANY | `/edge-api/v1/admin/ops/**` | `der.system.settings.write` |
| ANY | `/edge-api/v1/admin/roles/**` | `der.roles.write` |
| POST | `/edge-api/v1/referral/inbox/*/accept` | `der.referrals.accept` |
| POST | `/edge-api/v1/referral/inbox/*/dismiss` | `der.referrals.dismiss` |
| P/P/D | `/edge-api/v1/network/firewall/**` | `der.network.firewall.write` |
| P/P/D | `/edge-api/v1/network/peers/**` | `der.network.peer.write` |
| P/P/D | `/edge-api/v1/network/**` (other writes) | `der.network.topology.write` |
| POST | `/edge-api/v1/system/hardware/**` | `der.system.hardware.write` |
| GET | `/edge-api/v1/security/hardening/vault/**` | `der.system.vault.read` |
| ANY | `/edge-api/v1/testing/**` | `der.system.testing.run` |
| POST | `/edge-api/v1/compliance/**` | `der.compliance.manage` |
| GET | `/edge-api/v1/compliance/**` | `der.compliance.read` |

## 5. Managing roles

- **UI:** `/admin/access/roles` (admin UI). ADMIN or anyone with
  `der.roles.write` can create / edit / delete roles, with an
  authority-picker grouped by module.
- **API:** `GET/POST/PUT/DELETE /edge-api/v1/admin/roles` — gated by
  `der.roles.write`. Authority catalogue: `GET
  /edge-api/v1/admin/roles/authorities/catalog`.
- Every mutation is audited as `ROLE_CREATED`, `ROLE_UPDATED`, or
  `ROLE_DELETED` on the security audit stream.
- Built-in roles (`is_builtin = TRUE`) cannot be renamed or deleted;
  their authority lists remain editable.
- Assigning a role to a user flows through the user-provisioning
  surface (gated by `der.users.role.assign`).

## 6. Non-goals (still)

- Fine-grained per-record ACL (write-only-to-own-OU, etc.) — not in
  the current threat model. Postgres RLS could layer this later.
- API-key auth — all auth is cookie-session based per ADR-0028.
- Rate limiting per-authority — rate limits are per-user. Add
  authority-aware rate limits before scaling the operator surface.
