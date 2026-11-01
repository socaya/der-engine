# der-2.3.63 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.62`

## Headline

**WorkflowMonitoring adheres to the shared DER dashboard idiom.**
Dropped the one-off summary-tile strip introduced in 2.3.61; the
Monitoring page now uses the same `SyncStatusBar` + `Panel` +
`.ea-table--dense` layout as DHIS2 Overview and Sync Overview.

## 1. What changed

- Removed custom components / styles:
    - `SummaryTile` helper function.
    - `.ea-wf-monitor-summary`, `.ea-wf-monitor-tile*` CSS block.
- Summary facts (Completed 24 h / Errors / Conflicts) folded into
  the `SyncStatusBar` subtitle beside the existing
  Ready / Blocked / Workflows / Devices / Updated facts — matching
  how Sync Overview surfaces its live counters.
- Every body section remains a `Panel` with `.ea-table--dense`
  content: *Blockages · Open issues · Pending conflicts · Draft
  data captured so far · Recent activity · By workflow · By owner
  device · Turnaround percentiles · Device turnaround · Service-
  point pressure · Prefetch readiness*.

Operator-facing drill-outs stay removed (2.3.62) — row-level links
only go to the admin workflow-detail page.

## 2. Files changed

```
admin-ui/src/screens/workflow/WorkflowMonitoring.tsx  — drop SummaryTile,
                                                         extended SyncStatusBar
                                                         subtitle with summary facts
admin-ui/src/styles.css                                — drop .ea-wf-monitor-*
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.63
```

## 3. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.63 bundle
cd admin-ui && npm test -- --run            245 passed, 4 pre-existing fails
cd server   && mvn -q -DskipTests package   ✓ der-server-2.3.63.jar (no code change
                                               since 2.3.62, pom bumped for ship pairing)
```

## 4. Follow-ups

- Inline drill-into on a draft row to pretty-print the full
  payload on the admin surface.
- Admin-side run detail view (step-by-step contributions rendered
  as form snapshots) so admins never need to visit operator UI.
