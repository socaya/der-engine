# der-2.3.123 — Admin cluster UI polish

Nine admin-side screens enhanced with the DER UI standards
(docs/ui/01-design-system-and-navigation.md): `SyncStatusBar` +
`Panel` + `Status` chips + proper `ErrorBlock` / `LoadingBlock` /
`EmptyBlock` states + `data-cross-module` Links + `data-test`
coverage on every actionable node.

## Access cluster

| Screen | Route | Key additions |
|---|---|---|
| Users dashboard | `/provisioning/users` | Real DHIS2-mapping column (consumes `listUserDhis2Mappings`) replacing the hard-coded 'Unmapped' chip; row-menu adds Map/Edit DHIS2 mapping; status-bar action for DHIS2 mappings. |
| **DHIS2 mappings (NEW)** | `/access/dhis2-mappings` | Edge-user → DHIS2-user mapping table with Map/Edit/Clear dialog (DHIS2 UID + username + optional display name). Search + status-bar mapped/unmapped counts. Audit cross-link. |
| Roles | `/access/roles` | 4-role catalogue with live per-role user counts from `listUsers`; 10-capability matrix pinned to `docs/security/role-capability-matrix.md`; per-role "View N-role users →" drills. |
| Sessions | `/access/sessions` | Recent SIGN_IN audit table via `securityAuditEvents`; session-policy `dl` with TTL + rotation path; cross-links to Credentials + audit stream. |
| Credentials | `/access/credentials` | Four Panels (Password policy, Session binding, Second factors + federation, Audit); every field cites its backing source (Argon2id params, cookie attrs, TTL property, ADRs). TOTP flagged Implemented, OIDC flagged Roadmap. |

## Devices cluster

| Screen | Route | Key additions |
|---|---|---|
| Device enrolment | `/devices/enrolment` | Per-row **Approve** + **Revoke** actions gated by `confirmThenRun`; post-action feedback line; enrolment-flow explainer panel; cross-links to fleet + network/clients. |
| Ownership | `/devices/ownership` | Search by deviceId or owner; status filter; Unassigned chip for approved devices without a user; per-row RowMenu (Open details, View audit). |
| Active connections | `/devices/connections` | Freshness chip (Fresh / Stale > 24 h) per device; stale count in status bar; search by deviceId / label. |
| Diagnostics | `/devices/diagnostics` | Firmware-drift panel (canonical version + distribution + drift count); "Show stale only" checkbox; firmware chip tone warns on drift. |

## New server surfaces reached

- `GET /edge-api/v1/admin/users/dhis2-mappings` + `PUT` + `DELETE` — now exposed in the admin UI (DHIS2 mappings screen)
- `GET /edge-api/v1/security/audit/events?eventType=SIGN_IN` — reached by the enhanced Sessions screen
- `POST /edge-api/v1/devices/{id}/{approve,suspend,revoke}` — reached by the enhanced enrolment screen

No new server endpoints; every wiring surface already shipped.

## Test matrix

- 3 new `MockupDhis2Mappings` tests (shape, Map dialog + save, rejection path)
- 2 new `CapRoles` tests (counts + matrix, error)
- 2 new `CapSessions` tests (audit table render, empty)
- 1 new `CapCredentials` test (policy panels + cross-links)
- 2 new `CapDeviceEnrolment` tests (pending queue actions, no-pending empty)
- 1 new `CapOwnership` test (search + filter prune rows)
- 1 new `CapConnections` test (fresh/stale chips)
- 2 new `CapDeviceDiagnostics` tests (firmware drift, stale-only toggle)

Gate: **PASS 33/33**. Coverage after cluster: **90.65 / 81.70 / 73.80**.

## No changes to server, no new ADRs

Pure admin UI depth-lift. The nine screens were already functional
stubs; this commit series brings them to the level of the FR-15-06..10
and FR-01-07/10 screens shipped in the preceding arc.
