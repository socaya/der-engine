# DER Android — 0.1.0-alpha (Play Internal)

First full native build of the DER Android client. Implements
Phases 1–10 of ADR-0041 end-to-end and is ready for a
5+ device pilot per `docs/operations/android-pilot-runbook.md`.

## Highlights

**End-to-end user flow**: first boot → QR-free device enrolment →
sign-in → optional biometric unlock → role-aware home → capture
(Data Entry + Capture) → service-point workflow → supervisor
approvals → operator dashboard → device admin.

**Offline-first**: every capture writes to a local Room journal
first; a WorkManager chain drains to the DER edge on reconnect
with exponential backoff.

**Peer-to-peer**: full WebRTC transport implementing DPP/1
(ADR-0038). When a workflow step completes, a workflow-advance
frame broadcasts to the peer mesh so the next service point can
auto-receive without round-tripping the edge.

**Role-aware shell**: CHW, facility operator, supervisor and admin
each see their own tile grid; the launcher derives from the
authenticated session's roles.

## What's in the box

| Module | Lives in | Status |
|---|---|---|
| Phase 1 — Compose + Hilt scaffold, DER theme | `android/app`, `android/core/design` | ✅ |
| Phase 2 — auth + device enrolment round-trip | `android/core/{auth,data}` | ✅ |
| Phase 3 — DerShell, role-aware tile grid | `android/app/ui/shell` | ✅ |
| Phase 3.5 — WebRTC peer mesh (DPP/1) | `android/core/p2p` | ✅ |
| Phase 4 — DER Data Entry MVP (aggregate) | `android/feature/dataentry` | ✅ |
| Phase 5 — DER Capture MVP (programs + events + tracker search) | `android/feature/capture` | ✅ |
| Phase 6 — Distributed workflow + mesh handoff | `android/feature/workflow` | ✅ |
| Phase 7 — Dashboard rollup | `android/feature/dashboard` | ✅ |
| Phase 8 — Approvals + referral inbox | `android/feature/approvals` | ✅ |
| Phase 9 — Settings (server URL + diagnostics + clear data) | `android/feature/settings` | ✅ |
| Phase 10 — Biometric unlock + release signing + AAB | `android/app`, `android/core/auth` | ✅ |
| Phase 11 — Beta readiness (crash log + feedback + runbook) | this release | ✅ |

## Server endpoints consumed

- `POST /edge-api/v1/auth/sign-in`, `GET /auth/session`, `POST /auth/sign-out`
- `POST /edge-api/v1/devices/enroll`, `GET /edge-api/v1/devices/{id}`
- 7 × `/edge-api/v1/webrtc/*` signalling endpoints
- `GET /api/dataSets`, `GET /api/dataSets/{id}`, `POST /api/dataValueSets`
- `GET /api/programs`, `GET /api/programs/{id}`, `GET /api/tracker/trackedEntities`
- `POST /edge-api/v1/tracker/events`
- `GET /edge-api/v1/workflows/queue`, `GET /workflows/runs/{id}`,
  `GET /workflows/runs/{id}/readiness`, `POST /workflows/runs/{id}/steps/{id}/contribute`
- `GET /edge-api/v1/approvals/pending`, `POST /approvals/{id}/{approve,reject}`
- `GET /edge-api/v1/referral/inbox`, `POST /referral/inbox/{id}/{accept,dismiss}`

## Known limitations (deferred by design)

- **Program rule engine** — tracker enrol + stage-new need the
  DHIS2 rule engine port. Shipped as the next Android sub-phase.
- **Incoming peer frame consumer** — the mesh broadcasts
  workflow-advance frames; the receiving side's auto-apply lands in
  a dedicated sub-phase alongside the peer-side journal mirror.
- **DPP/1 TTL relay routing** — Phase 3.5 ships point-to-point data
  channels only; multi-hop TTL is a later sub-phase.
- **Section forms + option sets + validation rules** — Data Entry
  renders a flat input per data element.
- **Period picker** — period strings are typed as raw DHIS2
  identifiers (e.g. `202611`).
- **Admin-only endpoints** (system/info, dhis2-connection, sync/drift)
  are not called by the Android client; the dashboard uses
  edge reachability as a proxy.

## Verification

```
cd android
./gradlew :app:assembleDebug test        # 59 MB debug APK, all unit tests green
./gradlew :app:bundleRelease             # 24 MB signed AAB; per-device install ~15 MB
```

Unit tests cover the wire contracts that would silently break
server↔client interop: `DppFrameCodecTest`, `SignInResultMapping`,
`EnrolmentStatusMapping`, `DataValueSetPayloadTest`,
`TrackerEventPayloadTest`, `WorkflowReadinessTest`,
`ApprovalOutcomeTest`, `ReferralOutcomeTest`,
`ServerUrlRepositoryTest`, and `LauncherTilesTest` for role
filtering.

## Pilot plan

Follow `docs/operations/android-pilot-runbook.md` for the full
check-list. Target 5+ devices, 2 weeks, ≥ 99% crash-free session
rate, ≥ 99% offline→drain success rate within 24 h of reconnect.

## Related ADRs

- ADR-0041 — Native Android client (this release)
- ADR-0038 — DER Peer Protocol v1 (DPP/1)
- ADR-0019 — Device management + enrolment
- ADR-0036 — Capture form API
- ADR-0030 — Capacitor wrap (now scope-limited to admin read-mostly)
