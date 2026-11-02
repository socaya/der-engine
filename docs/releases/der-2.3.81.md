# der-2.3.81 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.80`

## Headline

**Data (Local Storage) module — Aggregate browse surface. DER's
local-first store is now visible in the admin UI with a pipeline
strip and per-row sync-state chips. Capture still launches the
DHIS2 web app that runs on the edge.**

## 1. The idea

DER's edge *is* the facility's local DHIS2 for day-to-day capture:
every write first lands in a domain table
(`aggregate_data_value`, `event`, …), gets atomically journalled to
`operation_journal`, and is drained to Central by the sync worker.

Until now none of that locally-stored data was visible in the admin
UI — the Data module screens just launched the DHIS2 web apps. This
release opens the kimono for **aggregate**: see what's stored, see
where it is in the outbox pipeline, click a chip to drill into the
sync surface for the row.

Events / enrolments / TEIs follow in later R-C releases.

## 2. New server endpoint

**`GET /edge-api/v1/data/aggregate`**

Query params (all optional): `orgUnit`, `period`, `dataElement`,
`limit` (default 100, max 500).

Returns `{ rows, limit, pipeline }`:

- `rows` — `aggregate_data_value` with a per-row `syncState` and
  `operationId` joined from the latest `operation_journal` entry
  on the DHIS2 compound key
  (`dataElement|orgUnit|period|coc|aoc`).
- `pipeline` — fleet-wide counts for the pipeline strip:
  `captured`, `inJournal`, `pendingPush`, `synced`, `attention`.

Implemented via a single JDBC controller
(`web/DataModuleController.java`) with correlated subqueries; no
schema changes, no new repositories.

## 3. New admin screen — `/data/aggregate`

Replaces the old `CapAggregate` launch tile. Elements:

- **Breadcrumb** — `Data › Aggregate`.
- **Status bar** — row count + two actions: **Open DHIS2 capture**
  (new tab to `/dhis-web-dataentry/index.html`) and **Sync queue**.
- **Pipeline strip** — five click-through tiles:
  Captured · In journal · Pending push · Synced · Needs attention.
  Links feed `/sync/data` / `/sync/attention`.
- **Rows panel** — paginated table with filters:
  search, period, orgUnit UID, dataElement UID, page size.
- **Sync-state chip** per row — colour-coded tone + deep-link to the
  Sync module scoped by `operationId` when available:
  `Pending push`, `Sending…`, `Retrying`, `Synced`, `Rejected`,
  `Conflict`, `Approval`, `Quarantined`, `Unknown`, or `Local only`
  when no journal entry exists yet.

## 4. Files changed

```
server/src/main/java/.../web/DataModuleController.java   — NEW controller
admin-ui/src/api/edgeApi.ts                              — LocalDataSyncState,
                                                             LocalAggregateRow,
                                                             LocalAggregatePipeline,
                                                             listLocalAggregate()
admin-ui/src/screens/DataAggregate.tsx                   — NEW browse screen
                                                             (pipeline strip
                                                             + rows table
                                                             + sync chips)
admin-ui/src/App.tsx                                     — /data/aggregate →
                                                             DataAggregate;
                                                             CapAggregate import
                                                             removed
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.81
```

## 5. Verified

```
cd server   && mvn -q -DskipTests compile    ✓ clean
cd admin-ui && npx tsc --noEmit              ✓ clean
cd admin-ui && npm run build                 ✓ 2.3.81 bundle (785 ms)
cd admin-ui && npm test                      ✓ 245/249 pass (4 pre-existing
                                               CWF-01 RowMenu delete tests
                                               unrelated)
```

## 6. Follow-ups (R-C sequence)

- **R-C/2** — Events + Event-data-values browse at `/data/events`.
- **R-C/3** — Enrolments + TEIs browse at `/data/tracker`.
- **R-C/4** — Native capture in the admin UI (replacing the DHIS2
  web-app bridge for operators who prefer the DER surface).
- **R-A-data** — populate `operation_journal.workflow_run_id` so the
  Workflows ↔ Data filter chip from 2.3.80 becomes a real filter.
- Pre-existing CWF-01 RowMenu delete tests.
