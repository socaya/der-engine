# der-2.3.86 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.85`

## Headline

**Central-DHIS2 download system workflow — facilities going fully
local-first can pull existing aggregate values from Central into
DER with full workflow lineage.**

## 1. Why

A facility opts into the DER edge-first model but may already have
historical / running-total aggregate values recorded in Central
DHIS2. Operators who then capture against the local-only store
have no baseline to reconcile against. R-C/1.4 wires a
server-side pull that lands those values in the local
`aggregate_data_value` table, tagged with a dedicated
**CENTRAL_DOWNLOAD** system workflow run, and lets them flow
through the normal sync pipeline. Round-tripping back to Central
is idempotent on the compound key — the mirror just confirms it
matches upstream.

## 2. Schema — V075

Seeds one more system workflow:

```
workflow_id             | 00000000-0000-0000-0000-000000000003
display_name            | System · Central DHIS2 download
bound_metadata_kind     | SYSTEM
bound_metadata_id       | CENTRAL_DOWNLOAD
kind                    | SYSTEM
```

## 3. New service — `CentralDownloadService`

```java
PullResult pullAggregate(dataSetUid, orgUnitUid, periodIso, actor, ip, ua);
```

Steps:

1. `SystemWorkflowService.ensureCentralDownloadRun(dataSet, orgUnit, period, actor)` →
   returns the system run UUID (upserts on
   `(workflow_id, workflow_version, business_key)` so repeated
   pulls for the same scope share one run).
2. `Dhis2ReferenceClient.fetchJson("/api/dataValueSets.json?dataSet=…&orgUnit=…&period=…")`
   on Central.
3. For each returned `dataValue`, build a `DataValueInput` carrying
   the run UUID and feed it through
   `AggregateDataValueService.submit(...)` — same validation,
   dataset tag, and outbox journal as a local write.

Returns `{ runId, imported, ignored, errors[] }`.

## 4. New endpoint

```
POST /edge-api/v1/data/aggregate/pull-from-central
{ "dataSet": "…", "orgUnit": "…", "period": "…" }
→ 200 { "runId": "…", "imported": N, "ignored": M, "errors": [...] }
→ 400 if any field missing
→ 503 if Central unreachable
→ 502 if Central returns a malformed payload
```

## 5. Admin UI

`/data/aggregate` adds a **Pull from Central** action next to
Open DHIS2 capture. Clicking opens a modal dialog with
dataSet / orgUnit / period inputs (prefilled from the current list
filters when set). On submit the result panel shows import counts
and a direct deep-link to the resulting workflow run
(`/workflows/monitoring/runs/{runId}`).

## 6. Files changed

```
database/migrations/V075__central_download_system_workflow.sql     — NEW
server/.../workflow/SystemWorkflowService.java                      — + ensureCentralDownloadRun
server/.../workflows/aggregate/CentralDownloadService.java          — NEW
server/.../web/DataModuleController.java                            — POST
                                                                      /aggregate/pull-from-central
admin-ui/src/api/edgeApi.ts                                        — PullAggregateResult +
                                                                      pullAggregateFromCentral
admin-ui/src/screens/DataAggregate.tsx                              — Pull from Central
                                                                      action + modal
VERSION / server/pom.xml / admin-ui/package.json / sw.js           — 2.3.86
```

## 7. Verified

```
cd server   && mvn -q -DskipTests compile    ✓ clean
cd admin-ui && npx tsc --noEmit              ✓ clean
cd admin-ui && npm run build                 ✓ 2.3.86 bundle (779 ms)
```

## 8. Follow-ups

- **R-C/2 / R-C/3** — thread `workflowRunId` through
  `EventService`, `EnrollmentService`, `TrackedEntityService` and
  flip their NOT NULL guards (sister policy to aggregate).
- Central-download UX polish: picker widgets with
  dataSet / orgUnit / period dropdowns populated from the local
  mirror instead of free-text UID input.
- Background scheduling: operator-triggered pulls today, cron
  schedule for recurring pulls once we see what the pilot wants.
- Pull progress for large result sets (currently synchronous and
  times out at 1 min on Central's side).
