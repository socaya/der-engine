# DER role-capability matrix

**Scope:** HTTP endpoints under `/edge-api/v1/**`, grouped by the
role Spring Security requires. Fallback for anything not matched:
`.anyRequest().denyAll()` — explicit allow-list only.

**Roles present in the system:**

| Role | Granted by | Typical holder |
|---|---|---|
| `ADMIN` | Bootstrap provisioning + explicit grant by another ADMIN | Facility admin, cluster operator |
| `OPERATOR` | Default on account creation | Data-capture staff |
| (unauthenticated) | — | Pre-login + public health probes |

## Public (no auth required)

| Method | Path | Purpose |
|---|---|---|
| ANY | `/admin/**` | Admin UI SPA shell |
| GET | `/favicon.ico`, `/favicon.svg` | Browser icon |
| GET | `/edge-api/v1/system/health` | Reverse-proxy readiness probe |
| GET | `/edge-api/v1/system/hardware/leds` | On-device panel (physical access) |
| POST | `/edge-api/v1/auth/sign-in` | Sign-in endpoint |
| POST | `/edge-api/v1/peer-lifecycle/invites/redeem` | Peer onboarding |
| POST | `/edge-api/v1/peer-mesh/adjacency` | Mesh gossip |
| POST | `/edge-api/v1/messaging/relay` | Message relay between peer edges |
| GET | `/actuator/health`, `/actuator/info`, `/actuator/prometheus` | Monitoring |
| GET | `/error` | Spring internal forward (Phase 7 fix) |

## OPERATOR + ADMIN (authenticated — any role)

Default behaviour for anything not explicitly ADMIN-gated.

| Method | Path | Purpose |
|---|---|---|
| GET | `/edge-api/v1/dhis2/ping` | Central reachability (not /dhis2/**, just /ping) |
| GET | `/edge-api/v1/dhis2/reachability` | Phase 8 reachability gate state |
| GET | `/edge-api/v1/dhis2/compatibility` | Compat snapshot |
| GET / POST | `/edge-api/v1/data/**` | Local data capture + queue |
| GET / POST | `/edge-api/v1/drafts/**` | Draft CRUD + publish (Phase 7.1) |
| POST | `/edge-api/v1/drafts/{id}/publish` | Phase 7.1 publish flow |
| POST | `/edge-api/v1/referrals/ack` | Phase 10.3 destination-side ack |
| GET | `/edge-api/v1/data/pull/cursors` | Phase 9.5 cursor status |
| GET / POST | `/edge-api/v1/journal/**` (except `/next-hop`) | Conflict review + per-op lookup |
| POST | `/edge-api/v1/journal/conflicts/{id}/resolve` | Operator resolution |
| GET / POST | `/edge-api/v1/apps/**` | Installed-app surface |
| GET / POST | `/edge-api/v1/peer-mesh/**` | Peer-mesh membership |
| GET / POST | `/edge-api/v1/webrtc/**` | WebRTC signalling |
| GET / POST | `/edge-api/v1/system/hardware/**` (except POST writes) | Hardware readback |
| GET | `/edge-api/v1/security/hardening/**` (except vault) | Security posture readback |
| GET / POST | `/edge-api/v1/fleet/**` | Fleet membership |
| GET / POST | `/edge-api/v1/user-prefs/**` | Per-user preferences |
| GET / POST | `/edge-api/v1/packaging/**` | Package metadata |
| GET / POST | `/edge-api/v1/messaging/**` (except relay) | Inter-device messaging |
| GET | `/edge-api/v1/compliance/**` | Compliance readback |
| ANY | `/api/**`, `/dhis-web-**/**` | DHIS2 app shell + Web API passthrough |

## ADMIN only

Mutating or privileged.

| Method | Path | Purpose |
|---|---|---|
| GET | `/actuator/metrics` | Operator-visible metrics |
| ANY | `/edge-api/v1/dhis2/**` | Central connection config |
| ANY | `/edge-api/v1/provisioning/**` | User + device provisioning |
| ANY | `/edge-api/v1/sync/**` | Sync worker control |
| ANY | `/edge-api/v1/backup/**`, `/edge-api/v1/restore/**` | Backup / restore |
| POST | `/edge-api/v1/system/org-unit` | Org-unit binding |
| GET | `/edge-api/v1/workflows/metrics` | Workflow metrics |
| ANY | `/edge-api/v1/workflows/activity/**` | Activity feed |
| POST / PUT / DELETE | `/edge-api/v1/workflows/**` | Workflow CRUD |
| POST | `/edge-api/v1/devices/*/approve`, `/suspend`, `/revoke` | Device lifecycle |
| DELETE | `/edge-api/v1/devices/**` | Device removal |
| POST | `/edge-api/v1/analytics/refresh` | Analytics compute |
| GET | `/edge-api/v1/security/audit/verify` | Hash-chain verification |
| POST | `/edge-api/v1/journal/{opId}/next-hop` | Referral routing tag |
| ANY | `/edge-api/v1/admin/ops/**` | Journal purge + manual reap |
| POST | `/edge-api/v1/system/hardware/**` (writes) | Hardware writes |
| GET | `/edge-api/v1/security/hardening/vault/**` | Vault inspection |
| ANY | `/edge-api/v1/testing/**` | Chaos / fault injection |
| POST | `/edge-api/v1/compliance/**` | Compliance mutations |

## Phase 10–12 endpoints: audit result

Reviewed per the Phase 12 gap register:

| Endpoint | Introduced | Gating | Appropriate? |
|---|---|---|---|
| `GET /dhis2/reachability` | 8 | authenticated | ✅ read-only system state |
| `POST /drafts/{id}/publish` | 7.1 | authenticated | ✅ owns own drafts (controller enforces owner match) |
| `GET /data/pull/cursors` | 9.5 | authenticated | ✅ read-only |
| `POST /referrals/ack` | 10.3 | authenticated | ⚠️ **flagged for review** — destination edge posts an ack carrying the origin's operationId. A compromised OPERATOR account could mark referrals DELIVERED without actually ingesting. Mitigation: cross-check `destinationOrgUnit` against the origin's `next_hop_org_unit_uid`. Deferred to Phase 13. |

## Non-goals (explicit)

- Fine-grained per-record ACL (write-only-to-own-OU, etc.) — not in
  the current threat model. Postgres RLS could layer this later.
- API-key auth — all auth is cookie-session based per ADR-0028.
- Rate limiting — not shipped. Add before public pilot.
