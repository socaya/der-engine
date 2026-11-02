# der-2.3.88 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.87`

## Headline

**R-C/2.3 — P1 quick wins from the Data-module audit: real
server-side filter for `/data/drafts?workflowRunId=…` + Workflow →
Data deep-links completed.**

## 1. Drafts filter is now real

The `ScopedFilterChip` on `/data/drafts` was previously surface
only — the client parsed the URL param but the request to
`/edge-api/v1/drafts` ignored it. Now:

- `DraftRepository.findByOwner(ownerId, workflowRunId)` — overload
  with runId filter; delegates to the single-arg form when null.
- `DraftController.list(authentication, workflowRunId)` — reads
  `?workflowRunId=` query param; returns 400 if present but not a
  UUID; passes through to the repository filter.
- `edgeApi.listDrafts({ workflowRunId? })` — client passes the UID
  through.
- `CapDrafts` reloads when the URL param changes.

Drafts drill from Workflow Monitoring now shows only the drafts
belonging to that run.

## 2. Workflow run detail → Data: full round-trip

`WorkflowRunDetail` action bar previously carried three Sync /
Drafts exits. Added two more:

- **Aggregate** → `/data/aggregate?workflowRunId=…`
- **Events** → `/data/events?workflowRunId=…`

Both targets already filtered server-side (R-C/1.3 / R-C/2), so
chip + list are consistent. Row count drops to just the data the
run produced, and the chip's "Open run" link closes the loop.

## 3. Not in scope

Audit's **P2-4** (enrollment + TEI workflow linkage) + **P1-1**
(Tracker browse) deferred to **R-C/3** because the active tracker
write path uses the `edge_*` tables (`edge_enrollment`,
`edge_tracker_event`, `tracked_entity`), not the newer
`enrollment` / `tracked_entity_instance` tables V072 touched.
Shipping those gaps correctly needs:

- `workflow_run_id` columns added to the `edge_*` tables.
- Threading through `EnrollmentRepository`, `TrackedEntityRepository`,
  `TrackerEventRepository`.
- `TRACKER_CAPTURE` system workflow (`0..05`) + auto-wrap on the
  tracker controllers.
- V078 enforcing NOT NULL across the three edge tables.
- `DataTracker` browse screen + `GET /edge-api/v1/data/tracker`.

Scoped as R-C/3.

Audit's **P2-6** (Sync Attention ↔ Data row backlink) also
deferred — needs an entityType → data route mapping on conflict
detail that's a separate design.

## 4. Files changed

```
server/.../workflows/drafts/DraftRepository.java         — findByOwner(ownerId, runId)
server/.../web/DraftController.java                      — ?workflowRunId= param
server/.../test/.../DraftControllerTest.java             — stub updated

admin-ui/src/api/edgeApi.ts                              — listDrafts({workflowRunId})
admin-ui/src/screens/CapabilityScreens.tsx               — CapDrafts threads
                                                             workflowRunId;
                                                             reloads on change
admin-ui/src/screens/workflow/WorkflowRunDetail.tsx      — + Aggregate + Events
                                                             action buttons
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.88
```

## 5. Verified

```
cd server   && mvn test -Dtest='DraftControllerTest'    ✓ 13/13
cd server   && mvn -q -DskipTests compile               ✓ clean
cd admin-ui && npx tsc --noEmit                         ✓ clean
cd admin-ui && npm run build                            ✓ 2.3.88 bundle (763 ms)
```

## 6. Follow-ups

- **R-C/3** — Tracker browse (`/data/tracker`) + enrolment/TEI
  workflow linkage on the active `edge_*` tables + V078
  enforcement + TRACKER_CAPTURE system workflow.
- **R-C/2.1** — Central-download for events (sibling of 2.3.86).
- **R-C/2.2** — Row-detail pages for aggregate + event (click row
  → full payload + journal history + sync retry log).
- **Sync Attention ↔ Data** — conflict detail backlink to the
  originating row (needs entityType → route mapping).
