# der-2.3.62 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.61`

## Headline

**Monitoring stays admin-scoped + draft-data visibility.** New
`/workflows/activity/drafts` endpoint surfaces what each service
point has actually captured on in-flight runs. All drill-downs on
Monitoring (and the Activity overview tiles) now stay inside the
admin surface — no more redirecting admins to operator-facing
pages.

## 1. Draft data captured so far

### Server

`GET /edge-api/v1/workflows/activity/drafts?limit=N` (ADMIN).
Reads `capture_workflow_step_contribution` joined against runs
still in `OPEN`/`AWAITING` and returns per-contribution rows:

```json
{
  "rows": [{
    "contributionId", "workflowId", "workflowName",
    "runId", "businessKey",
    "stepId", "stepName",
    "submittedAt", "submittedDeviceId", "submittedDeviceName",
    "fieldCount",    // top-level JSON keys in the payload
    "preview"        // 160-char flattened payload preview
  }]
}
```

Ordered newest-first. Admin can see exactly what each service
point has recorded without opening every run.

### UI

New **Draft data captured so far** panel on Monitoring, matching
the shared `.ea-table--dense` idiom:

| Service point | Run | Fields | Captured by | Payload preview | Captured |

Shows top 15 in-flight contributions.

## 2. Monitoring stays admin-scoped

Previously, panel-head actions and Activity-overview tiles sent
admins into the operator-facing surfaces (`/workflows/queue`,
`/approvals`, `/referral/inbox`, `/devices`). The Monitoring
module is admin-only — drill-downs now stay inside the admin
surface:

- Panel-head drill-outs removed (By workflow / By device /
  Service-point pressure, Device turnaround).
- `WorkflowActivity` tiles redirect to `/workflows/monitoring`
  instead of operator surfaces.
- Row-level links still open the admin workflow detail page
  (`/workflows/{id}`) — never the client-UI operator queue.

Operator / reviewer / intake surfaces (`/workflows/queue`,
`/approvals`, `/referral/inbox`) remain reachable as
`status: 'contextual'` routes for direct URLs / bookmarks, but
nothing in the admin sidebar or Monitoring surface sends anyone
there.

## 3. Files changed

```
server/src/main/java/.../web/WorkflowActivityController.java   — +drafts endpoint,
                                                                   countTopLevelFields,
                                                                   preview helpers
admin-ui/src/api/edgeApi.ts                                     — getWorkflowDrafts +
                                                                   WorkflowDraftRow type
admin-ui/src/screens/workflow/WorkflowMonitoring.tsx           — drafts state + reload +
                                                                   panel; drill-out
                                                                   actions removed
admin-ui/src/screens/workflow/WorkflowActivity.tsx             — tile drill links to
                                                                   /workflows/monitoring
VERSION / server/pom.xml / admin-ui/package.json / sw.js        — 2.3.62
```

## 4. Verified

```
cd server    && mvn -q -DskipTests compile  ✓ clean (Checkstyle included)
cd server    && mvn -q -DskipTests package  ✓ der-server-2.3.62.jar
cd admin-ui  && npx tsc --noEmit            ✓ clean
cd admin-ui  && npm run build               ✓ 2.3.62 bundle
cd admin-ui  && npm test -- --run           245 passed, 4 pre-existing fails
```

Live stack is still on `der-server-2.3.61.jar` (PID 47207). Swap
to the new jar in-place when ready — V067 and V068 already
applied; this release ships no new migration.

## 5. Follow-ups

- Drill into a draft contribution to see the full pretty-printed
  payload inline on the admin surface (currently the preview is
  a 160-char teaser).
- Admin-side read-only run detail view (step-by-step with each
  contribution's payload rendered as a form snapshot) so the
  admin never needs to visit the operator-UI run page.
