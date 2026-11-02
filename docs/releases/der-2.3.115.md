# der-2.3.115 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.114`

## Headline

**Scope-aware data pipeline, end-to-end.** The three deferred R-AK
follow-ups all shipped:

- Server-side scope audit: `GET /admin/ops/scope/audit`.
- UI scope-check banner mirrored on **DataEventDetail** +
  **DataAggregateDetail** (TEI detail got it in R-AK).
- Smoke script `tracker_e2e.sh` auto-reads the edge's bound OU.
- Clean seed script `scripts/seeds/seed_bound_ou_data.sh` posts
  aggregate + single-event + TEI/enrol/stage-event all under the
  bound OU so sync can be exercised without triggering the
  "Out of bound OU" banners.

## 1. R-AL — components

### `GET /edge-api/v1/admin/ops/scope/audit`

New endpoint, backed by `ScopeAuditService`
(`server/.../orgunit/ScopeAuditService.java`). Returns:

```json
{
  "boundOrgUnitId": "HL2zXaIULBe",
  "boundOrgUnitPath": "/ZEzf44yY3Kd/T4LOE9sCy2R/QLtB3RDiv2c/HL2zXaIULBe",
  "total": 6,
  "countsByEntityType": {
    "AGGREGATE_DATA_VALUE": 0,
    "EVENT": 0,
    "TRACKED_ENTITY": 4,
    "ENROLLMENT": 1,
    "PROGRAM_STAGE_EVENT": 1
  },
  "samplesByEntityType": { ... up to `sampleLimit` rows per type ... }
}
```

Query logic: `NOT EXISTS (SELECT 1 FROM metadata_organisation_unit
WHERE dhis2_uid = <row.org_unit_uid> AND path LIKE
<bound_path>%)`. Walks five tables:
`aggregate_data_value`, `event`, `tracked_entity`,
`edge_enrollment`, `edge_tracker_event`. Returns an empty snapshot
when the edge is unbound (no path to compare against). Admins
authenticate; sampleLimit capped at 50 server-side.

### UI scope-check mirror

Factored the TEI detail's in-scope logic into two shared helpers
in `screens/shared.tsx`:

- `isInEdgeOrgUnitScope(rowOrgUnit, edgePath)` — reusable one-line
  check matching the server's path-prefix rule.
- `<OutOfScopeBanner>` — the labelled warning element with the
  "possible causes" explanation and the labelled drill to
  `/integration/organisation-unit`.

Applied to:
- `DataTeiDetail` (now uses the shared helpers).
- **`DataAggregateDetail`** — tone + status label flip to warning,
  banner between header and panels.
- **`DataEventDetail`** — same pattern. Also preserves the previous
  `tone=success` for COMPLETED events, downgrading to `warning` only
  when the row is out of scope.

### `scripts/smoke/tracker_e2e.sh` — auto-detect ORG_UNIT

Previously hard-coded `ORG_UNIT=nKz5rXN02cd` (Albion VCA — not the
edge's bound OU in this environment, which is why historical smoke
TEIs appeared out-of-scope on the detail pages).

Now the script resolves `ORG_UNIT` from
`GET /edge-api/v1/system/org-unit`'s `orgUnitId` when the env var
is unset. Operators who want to deliberately test the out-of-scope
flow can still set `ORG_UNIT=<some-other-uid>` in env.

### `scripts/seeds/seed_bound_ou_data.sh`

New script seeding **three clean, bound-OU-aligned rows**:

1. One aggregate value via `/api/dataValueSets` (DHIS2 passthrough).
2. One single-event via `/api/events`.
3. One TEI + one enrolment + one stage event via the edge-API
   tracker paths.

All three use the edge's bound OU (read from `/system/org-unit`),
generate valid 11-char DHIS2 UIDs locally via a `dhis_uid()` shell
helper, and end with a JOURNAL_WORKER_DRAIN trigger so the ops flow
into Central immediately.

**Live verified:**

```
./scripts/seeds/seed_bound_ou_data.sh
[15:59] bound OU: A&A Medcare Medical Centre/Clinic (HL2zXaIULBe)
[15:59] aggregate seeded
[15:59] event seeded → gNW9wNO019y
[15:59] tracker chain seeded → TEI=MfETweFe4IF
                                enrol=xleVVFm00NP
                                stageEvt=pVdgjJ46qs0

GET /admin/ops/scope/audit  (post-seed)
  → total: 6  (all pre-existing stale rows; new seeds in-scope ✓)
GET /data/tracker/tei/MfETweFe4IF
  → orgUnit=HL2zXaIULBe (matches bound ✓)
```

## 2. Files changed

```
server/.../orgunit/ScopeAuditService.java            — NEW
server/.../web/OperationsAdminController.java        — GET /scope/audit

admin-ui/src/screens/shared.tsx                      — isInEdgeOrgUnitScope
                                                       + OutOfScopeBanner
admin-ui/src/screens/DataTeiDetail.tsx               — use shared helpers
admin-ui/src/screens/DataAggregateDetail.tsx         — + scope banner
admin-ui/src/screens/DataEventDetail.tsx             — + scope banner

scripts/smoke/tracker_e2e.sh                         — auto-detect ORG_UNIT
scripts/seeds/seed_bound_ou_data.sh                  — NEW seed script
                                                       + dhis_uid helper

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.115
```

## 3. Verified

```
cd server && ./mvnw test \
       -Dtest='DhisPeriodCodesTest,
               ReferralIngestServiceTest,
               ReferralInboxControllerTest,
               CaptureWorkflowControllerTest,
               JournalPublisherTest,
               TrackerServiceTest'                   ✓ 76/76
cd admin-ui && npx tsc --noEmit                      ✓ clean
scripts/lint/check_cross_module.sh admin-ui/src      ✓ clean
der-server-2.3.115.jar packaged + swapped            ✓ /system/health 200

./scripts/seeds/seed_bound_ou_data.sh                ✓ 3 rows under bound OU
GET /admin/ops/scope/audit                           ✓ 6 stale rows,
                                                       new seeds NOT in list
```

## 4. Follow-ups

Soft:
- Dashboard panel surfacing scope-audit counts (one tile, "N
  out-of-scope rows · View audit →"). The data is ready; just a UI
  tile.
- Server-side periodic job to warn on scope drift via the activity
  feed (if `total > 0` for ≥ 1 h, raise a system alert).
- Seed script could run idempotently (skip if already seeded) and
  honour `--clean` to purge prior seeds first. Deferred until pilot
  prep.
