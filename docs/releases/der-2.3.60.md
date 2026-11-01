# der-2.3.60 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.59`

## Headline

**Workflow step-timing telemetry + prefetch coordination.** The two
large follow-ups flagged in 2.3.59 are now wired end-to-end: the
server records every per-step readiness transition, exposes a
percentile-aggregating metrics endpoint, and pushes targeted
prefetch cues to downstream devices via SSE so clients can warm
their caches before the operator arrives.

## 1. Phase A — Step state transition log

### V067 migration

```sql
CREATE TABLE der.capture_workflow_step_transition (
    transition_id      BIGSERIAL PRIMARY KEY,
    workflow_id        UUID NOT NULL REFERENCES capture_workflow,
    run_id             UUID NOT NULL REFERENCES capture_workflow_run,
    step_id            UUID NOT NULL REFERENCES capture_workflow_step,
    from_state         TEXT CHECK (… BLOCKED/READY/IN_PROGRESS/COMPLETE),
    to_state           TEXT NOT NULL CHECK (…),
    transitioned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_device_id    UUID,
    actor_user_id      UUID
);
```

Append-only. Indexed by `(run_id, step_id, transitioned_at)`,
`(workflow_id, transitioned_at)`, and `transitioned_at` for
windowed aggregation.

### Coordinator hook

`WorkflowRunCoordinator.recordTransitions()` is called from
`openRun()` (baseline rows for every step) and `contribute()`
(after each readiness recompute). Diffs against
`CaptureWorkflowStepTransitionRepository.lastKnownState()` so only
genuine transitions insert a row.

### Metrics endpoint

```
GET /edge-api/v1/workflows/metrics?windowHours=24
```

Returns per-step and per-device wait + turnaround percentiles
computed server-side with `percentile_disc(0.50 / 0.95)` over the
trailing window:

```json
{
  "windowHours": 24,
  "perStep":   [{ "workflowId", "workflowName", "stepId", "stepName",
                  "completedCount", "turnaroundP50Ms",
                  "turnaroundP95Ms", "turnaroundMaxMs" }],
  "perDevice": [{ "deviceId", "deviceName",
                  "completedCount", "turnaroundP50Ms",
                  "turnaroundP95Ms" }]
}
```

ADMIN-only (security config). Window clamped to 1 h – 30 d.

### UI

`WorkflowMonitoring` grew two panels:
- *Turnaround percentiles · last N h* — top 12 steps by p95; window
  selector (1 h / 6 h / 24 h / 7 d / 30 d) in the panel head.
- *Device turnaround · last N h* — same aggregation keyed by the
  acting device.

## 2. Phase B — Prefetch coordination

### V068 migration

```sql
CREATE TABLE der.capture_workflow_prefetch (
    run_id         UUID,
    step_id        UUID,
    device_id      UUID,
    notified_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acked_at       TIMESTAMPTZ,
    PRIMARY KEY (run_id, step_id, device_id)
);
CREATE INDEX ix_capture_workflow_prefetch_device_pending
    ON der.capture_workflow_prefetch (device_id, notified_at)
    WHERE acked_at IS NULL;
```

### SSE stream

`WorkflowPrefetchStream.register(deviceId)` returns an `SseEmitter`
scoped to the subscriber's device. Fired by
`WorkflowRunCoordinator.recordTransitions()` whenever a step
transitions `BLOCKED → READY` and the step has an owner device —
notifies that device so its client can warm its cache before the
operator arrives.

### Endpoints

```
GET  /edge-api/v1/workflows/prefetch/stream?deviceId=…    (SSE)
GET  /edge-api/v1/workflows/prefetch/pending?deviceId=…   (catch-up)
POST /edge-api/v1/workflows/prefetch/{stepId}/acked?deviceId=…
```

Auth: any authenticated user. Device scoping enforced via query
param; a hostile device could ack another's row today — follow-up
to tie `deviceId` to the authenticated principal.

### UI

New *Prefetch readiness* panel on `WorkflowMonitoring`:
- One row per device, pending-count column, oldest unacked age,
  Status chip:
    * `Warm` (success) — no unacked rows
    * `In-flight` (info) — unacked < 5 min
    * `Not warming` (danger) — unacked > 5 min

Client-side cache warming (actually consuming the SSE events in
the operator client UI, running the fetches, posting the ack) is
the natural next step and lands on the device client, not here.

## 3. Phase C — Auto-prepare next-service-point records

The data plumbing for this landed with Phase B — the prefetch row
tells the next-service-point device "a record is coming". The
remaining work is on the **device client**: subscribe to
`/prefetch/stream`, prefetch and store the run context + prior-
step contributions, then POST the ack. That lives in the client
UI codebase; this release ships the server + admin surface it
depends on.

## 4. Files changed

```
database/migrations/V067__workflow_step_transition.sql    (new)
database/migrations/V068__workflow_prefetch.sql           (new)

server/src/main/java/.../workflow/CaptureWorkflowStepTransition.java            (new)
server/src/main/java/.../workflow/CaptureWorkflowStepTransitionRepository.java  (new)
server/src/main/java/.../workflow/CaptureWorkflowPrefetchRepository.java        (new)
server/src/main/java/.../workflow/WorkflowPrefetchStream.java                   (new)
server/src/main/java/.../workflow/WorkflowRunCoordinator.java                   — +transitions, +prefetch
server/src/main/java/.../web/WorkflowMetricsController.java                     (new)
server/src/main/java/.../web/WorkflowPrefetchController.java                    (new)
server/src/main/java/.../security/SecurityConfig.java                            — metrics ADMIN; prefetch auth

admin-ui/src/api/edgeApi.ts                               — getWorkflowMetrics,
                                                             listPrefetchPending, ackPrefetch
admin-ui/src/screens/workflow/WorkflowMonitoring.tsx      — turnaround + prefetch panels,
                                                             window selector
VERSION / server/pom.xml / admin-ui/package.json / sw.js   — 2.3.60
```

## 5. Verified

```
cd server    && mvn -q -DskipTests compile  ✓ clean (Checkstyle included)
cd server    && mvn -q -DskipTests package  ✓ der-server-2.3.60.jar
cd admin-ui  && npx tsc --noEmit            ✓ clean
cd admin-ui  && npm run build               ✓ 2.3.60 bundle
cd admin-ui  && npm test -- --run           245 passed; 4 pre-existing fails
                                               (CWF-01 RowMenu + CaptureWorkflowService test
                                                predate this release)
```

## 6. Follow-ups

- Client UI (device-side): consume `/prefetch/stream`, warm caches,
  POST the ack. Admin's *Prefetch readiness* panel flips the
  status chip from *Not warming* → *Warm* once this lands.
- Tie `deviceId` to the authenticated principal on the prefetch
  endpoints so a device can only ack its own rows (today enforced
  by convention, not by code).
- `IN_PROGRESS` state is reserved in the enum but not written by
  the coordinator. Once the client UI reports "operator opened the
  step", log it so wait vs service time can be separated.
- Auto-prepare of upcoming records at the next service point —
  belongs in the device client once prefetch is wired.
