# der-2.3.61 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.60`

## Headline

**Workflow monitoring — activity feed, blockage attribution, open
issues, pending conflicts.** The monitoring surface shipped in
2.3.59/60 told admins *what's happening*; this release adds *why
it's stuck and what to do about it*.

## 1. New admin endpoints — `/workflows/activity/*`

All ADMIN-only, aggregating existing tables (no new schema).

### `GET /workflows/activity/summary`
One-shot card for the Monitoring header:

```json
{ "completedLast24h": 42, "currentlyBlocked": 3,
  "openErrorIssues": 1, "openConflicts": 0 }
```

### `GET /workflows/activity/feed?limit=50`
Recent step transitions enriched with workflow / step / device
names (reads `capture_workflow_step_transition` + joins run +
device). Ordered newest-first.

### `GET /workflows/activity/blockages`
All steps whose most-recent transition is `BLOCKED`, each row
including the specific `COMPLETES_BEFORE` predecessor(s) that
haven't contributed yet. Lets the admin see *who's holding up
whom*.

### `GET /workflows/activity/issues?limit=200`
All open validation issues (joined against runs still in
`OPEN`/`AWAITING`), with severity / message / field-ref / step +
workflow attribution.

### `GET /workflows/activity/conflicts?limit=200`
All conflicts with `status = PENDING_REVIEW` + category + run
business-key.

## 2. New Monitoring panels (admin UI)

`WorkflowMonitoring` grew four panels and a summary tile strip:

- **Summary tiles** — Completed (last 24 h) · Blocked right now ·
  Error issues open · Conflicts pending. Each tile tone-coloured
  (info / warning / danger / neutral) based on count.
- **Blockages — review and troubleshoot** — one row per blocked
  step with its blocking predecessor(s) + "Since" age.
- **Open issues** — top 10 by severity · workflow / step / field
  attribution · detected-ago.
- **Pending conflicts** — top 10 with category + run key.
- **Recent activity** — top 20 transitions as a sync-style
  activity feed with Status chip, device, and ago.

All five tables use the shared `.ea-table--dense` idiom + Panel
chrome used by Sync Overview and DHIS2 Overview.

## 3. Server deploy

Server rebuilt from `main` with migrations V067 (step transitions)
and V068 (prefetch), the metrics + prefetch + activity controllers,
and SecurityConfig entries for all of them.

Running jar swapped from the pre-release 2.3.52 to the fresh
2.3.61 so Flyway applies V067 and V068 forward. Admin UI bundle
served off `admin-ui/dist/` picks up the new routes without a
further rebuild.

## 4. Files changed

```
server/src/main/java/.../web/WorkflowActivityController.java   (new)
server/src/main/java/.../security/SecurityConfig.java          — +activity ADMIN
admin-ui/src/api/edgeApi.ts                                     — getWorkflowActivityFeed /
                                                                   Blockages / Issues /
                                                                   Conflicts / Summary + types
admin-ui/src/screens/workflow/WorkflowMonitoring.tsx           — SummaryTile + 4 new panels
admin-ui/src/styles.css                                         — .ea-wf-monitor-summary +
                                                                   .ea-wf-monitor-tile*
VERSION / server/pom.xml / admin-ui/package.json / sw.js        — 2.3.61
```

## 5. Verified

```
cd server    && mvn -q -DskipTests compile  ✓ clean (Checkstyle included)
cd server    && mvn -q -DskipTests package  ✓ der-server-2.3.61.jar
cd admin-ui  && npx tsc --noEmit            ✓ clean
cd admin-ui  && npm run build               ✓ 2.3.61 bundle
cd admin-ui  && npm test -- --run           245 passed, 4 pre-existing fails

# Live:
kill 10675            # stop der-server-2.3.52.jar
java -jar server/target/der-server-2.3.61.jar  (via nohup, env from .env.local)
curl /edge-api/v1/system/health → "version":"2.3.61"
Flyway: V067 + V068 applied
```

## 6. Follow-ups

- Drill-down on blockage rows to the full run detail page.
- Snooze / dismiss on open issues so operators can quiet warnings
  that are known-safe.
- Device-level SLO heat-map (p95 turnaround × workflow × device).
- Client-UI prefetch handler (ack flow) so the Prefetch readiness
  panel starts flipping *Not warming* → *Warm*.
