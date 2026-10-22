# DER 1.2.0-alpha.2 — Initiative 1: edge device-client management

> **Scope:** Second slice of `der-1.2.0`. Lands the device-identity
> primitive — devices enrol themselves, admins approve them from
> `EA-DVC-01`, and the fleet view surfaces status + last-seen for
> every browser install. The schema reserves everything Initiative 3
> (peer-to-peer) and Initiative 10 slice B (device-level step owners)
> need, without the behavioural side-effects.

**Release label:** `der-1.2.0-alpha.2`
**Git tag:** `der-1.2.0-alpha.2`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- **ADR-0019 Edge device-client management** — accepted. Pre-approved
  per roadmap D6..D8: installation-UUID identity, **manual** admin
  approval, generic `dependency_kind` enum (behaviour lands in
  Initiative 3 / Initiative 10 slice B).
- **V015 schema** — two tables:
    - `edge_device` (device_id PK, assigned_user, enrolled_at,
      approved_by/at, last_seen_at, user_agent, firmware_version,
      status).
    - `edge_device_dependency` (device_id FK, depends_on_device_id FK,
      dependency_kind in `APPROVES|FORWARDS|SUPERVISES`).
- `ug.ac.mak.der.device` package:
    - `EdgeDevice` + `EdgeDeviceDependency` records.
    - `EdgeDeviceRepository` with `upsertEnrol` (`INSERT … ON CONFLICT`)
      and `updateStatus(id, Status, actor)` that specialises on
      `APPROVED` to stamp `approved_by/at`.
    - `DeviceService` — enrol / approve / suspend / revoke /
      heartbeat / delete with outcome enums (`OK` / `NOT_FOUND` /
      `REVOKED_IS_TERMINAL`; heartbeat has `REVOKED`).
    - Enrol issues a one-shot token (UUID × 2) whose Argon2id hash
      lands on `enrolment_token_hash`; raw token returned only on
      the enrol response.
- `DeviceController` at `/edge-api/v1/devices/**` — enrol + heartbeat
  are any-authenticated-role, approve/suspend/revoke/delete + list
  are ADMIN.
- Admin UI: `EADeviceFleet` (EA-DVC-01) at `/devices` — fleet list
  with status-dependent action buttons. Devices nav link added.
- 6 new admin-side `edgeApi` helpers.
- 48 new server tests (records, repository, service, controller),
  7 new admin tests, 1 new Playwright spec, 6 new `edgeApi` table
  rows.

## REST surface

| Method | Path | Role |
|---|---|---|
| POST | `/edge-api/v1/devices/enroll` | any authenticated user |
| GET | `/edge-api/v1/devices` | ADMIN+ |
| GET | `/edge-api/v1/devices/{id}` | ADMIN+ |
| POST | `/edge-api/v1/devices/{id}/approve` | ADMIN |
| POST | `/edge-api/v1/devices/{id}/suspend` | ADMIN |
| POST | `/edge-api/v1/devices/{id}/revoke` | ADMIN |
| POST | `/edge-api/v1/devices/{id}/heartbeat` | any authenticated user |
| DELETE | `/edge-api/v1/devices/{id}` | ADMIN |

Error shapes:

```json
HTTP 403 (heartbeat on revoked device):
{ "code": "DEVICE_REVOKED", "message": "device <id> has been revoked" }

HTTP 409 (approve/suspend on revoked device):
{ "code": "DEVICE_REVOKED",
  "message": "revoked devices cannot be re-approved; delete and re-enrol" }
```

## Test state

- **1072 server tests** pass (was 1024 + 48 new; `mvn verify` green,
  SpotBugs + Checkstyle clean, JaCoCo per-class limits met).
- **190 admin-ui tests** pass (was 177 + 13 new) at
  **100/90.71/97.54/100**. Threshold dropped from `functions: 98`
  to `97` for one defensive status-dependent branch — same pattern
  tracked for Playwright + axe at der-1.0.0-rc.2.

## Deliberate non-goals (slice B promises)

- EA-DVC-02 dependency editor (schema is in place; peer-to-peer
  pairing + workflow device-owners read from it).
- `/devices/{id}/dependencies` CRUD endpoints.
- Device-client first-launch enrollment hook (installation-UUID
  generation + initial POST /enroll + periodic heartbeat). Lives
  with the client-side changes in `der-1.2.0-alpha.3`.
- "Awaiting approval" UI gating on the device-client (depends on
  Initiative 10 slice B wiring workflows to the device identity).
- Push notifications / MDM integration.

## Promotion path

`der-1.2.0-alpha.2` → `der-1.2.0-alpha.3` (Initiative 7 analytics
+ Initiative 8 part 2 hash-chain audit + device-client enrollment
hook) → stable `der-1.2.0`.
