# der-2.3.16 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.15`

## Headline

**Operator work queue (spec §51–§52).** Every signed-in operator now
has an inbox at `/admin/workflows/queue`: workflow steps across all
active runs that are READY for them to pick up, plus the steps that
are BLOCKED on a predecessor. Updates every 15 seconds.

## 1. Server

### `GET /edge-api/v1/workflows/queue`

```
200 OK
{
  "rows": [
    {
      "runId":        "<uuid>",
      "workflowId":   "<uuid>",
      "workflowName": "ANC monthly reporting",
      "businessKey":  "2026-10-ou-xyz",
      "stepId":       "<uuid>",
      "stepOrdinal":  0,
      "stepName":     "Section A — identifying info",
      "ownerRole":    "OPERATOR",
      "ownerDeviceId": null | "<uuid>",
      "readiness":    "READY" | "BLOCKED",
      "runCreatedAt": "2026-10-31T04:00:00Z",
      "runUpdatedAt": "2026-10-31T04:15:33Z"
    },
    …
  ]
}
```

### Filtering rules

Walks every enabled workflow × every OPEN or AWAITING run, computes
readiness via `WorkflowRunCoordinator.computeReadiness`, and emits
one row per step that is READY or BLOCKED **and** that the caller is
entitled to see:

- **ADMIN** → every row.
- **Any other role** → rows whose `ownerRole` matches one of the
  caller's granted roles.

Rows are sorted newest-first by `runUpdatedAt` so operators triage
the latest work.

### Wiring

```
CaptureWorkflowController ← + WorkflowRunCoordinator (constructor arg)
SecurityConfig            ← GET /workflows/queue is authenticated-level
```

## 2. UI — `WorkflowQueue.tsx`

```
/workflows/queue          → WorkflowQueue (new)
```

- Three tabs: All · Ready · Blocked, with counts.
- One row per queue entry (workflow name + business key, step
  ordinal + name, role, readiness pill, updated-at, "Open run").
- Auto-refreshes every 15 s via `setInterval` so a step that becomes
  ready for the signed-in operator shows up without a page reload.
- Empty-state copy adapts per tab.

### Sidebar

Added `My queue` under the Workflows group so operators can find it
without typing the URL.

## 3. Verified live

```
Phase A  create workflow + open run via API    ✓ 2 steps, step B depends on A
Phase B  GET /workflows/queue                  ✓ 2 rows
                                                 #0 First op  / READY
                                                 #1 Second op / BLOCKED
Phase C  /admin/workflows/queue page           ✓ table rendered
                                                 1 Ready pill · 1 Blocked pill
Phase D  Ready-only tab                        ✓ 1 Ready visible · 0 Blocked
pageerrors                                     ✓ 0
```

## 4. Files changed

```
server/.../web/CaptureWorkflowController.java         — + GET /queue
server/.../security/SecurityConfig.java               — /queue authenticated
admin-ui/src/api/edgeApi.ts                           — workflowQueue()
admin-ui/src/screens/workflow/WorkflowQueue.tsx       (new)
admin-ui/src/App.tsx                                  — /workflows/queue route
admin-ui/src/app/navigation.ts                        — sidebar entry
admin-ui/src/styles.css                               — ea-queue-* + ea-pill
VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.16
```

## 5. What this still doesn't do

- Device-scoped filtering (a step bound to `ownerDeviceId=X` should
  only appear for the operator on that device). Lands when device
  ownership reaches the Spring Security principal.
- "Open run → go straight to the capture screen for this step." For
  now the row's "Open run" link lands on the runs list filtered to
  the workflow. Deep-linking to the actual capture surface
  (DC-aggregate, DC-event, DC-tracker) is a follow-up.
- SSE push instead of 15 s polling. The event bus already emits
  `WorkflowStepReadyEvent` — wiring that to a Server-Sent-Events
  stream is a future optimisation.

## 6. Build + test

```
mvn -q -DskipTests package      ✓ 2.3.16 JAR
tsc -b && vite build            ✓
End-to-end queue sweep          ✓ API + UI + tab filter
admin-ui unit tests             241/245 (4 pre-existing baseline failures)
```
