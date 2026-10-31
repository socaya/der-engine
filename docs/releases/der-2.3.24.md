# der-2.3.24 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.23`

## Headline

**Device-scoped queue filter + SSE push.** The operator queue now
updates reactively (23 ms from run-open → row visible instead of up
to 15 s) via a Server-Sent-Events stream, and operators can scope
the queue to a specific device so a tablet in the ANC room sees only
its own steps.

## 1. Server

### `GET /edge-api/v1/workflows/queue?deviceId={uuid}` (new query param)

- Omitted → the queue returns everything the caller's roles allow
  (unchanged).
- Provided → returns only steps whose `ownerDeviceId` is either `null`
  (shared pool) **or** equal to the supplied UUID.

Role filtering (2.3.16) still applies — the two filters compose.

### `GET /edge-api/v1/workflows/queue/stream` (new, SSE)

- Opens a long-lived SSE connection with 30 min keep-alive.
- Emits `hello` on connect with `{stream: "workflow-queue",
  subscribers: n}`.
- Emits `queue.invalidate` whenever a workflow run moves:
  - `WorkflowStepReadyEvent` (step becomes READY after a contribute)
  - `WorkflowRunCompletedEvent` (run finalises)
- Payload: `{cause: "<event class name>", at: "<ISO instant>"}`.

Implemented as `WorkflowQueueStream`, a Spring `@Component`
listening on the existing `ApplicationEventPublisher` events the
coordinator already emits (2.3.11). No new DB writes.

### Security

Both endpoints land under the existing authenticated-level
matcher. The SSE handler returns a self-completing emitter when the
principal is missing so the client sees the connection close rather
than a stuck request.

## 2. UI

- **Live indicator.** The queue heading grows a `● live` /
  `○ polling` pill driven by SSE connection state. "polling" is a
  degraded mode when the stream drops; a 60-second safety-net poll
  backs it up in case the stream silently dies (reverse proxies,
  laptop sleep, …).
- **Device scope dropdown.** Populated from `/edge-api/v1/devices`.
  Picking a device requeries the queue with `?deviceId=X`.
- **No more 15 s poll.** The `setInterval(15 000)` is replaced by:
  - `new EventSource('/edge-api/v1/workflows/queue/stream')`
  - a 60 s safety-net `setInterval` only, as fallback.

Freshly-opened runs appear in the queue within one network round-trip
of the server emitting the event.

## 3. Verified live

```
Phase A  queue page loads                       ✓ stream badge "● live"
                                                   device filter rendered

Phase B  open a new run via API                 ✓ row visible in UI
                                                   23 ms after the open-run request
                                                   (vs. up to 15 s before)

Phase C  ?deviceId=<bogus> query filter         ✓ steps with ownerDeviceId=null
                                                   still appear (shared pool)
                                                   steps bound to another device
                                                   would be excluded

pageerrors                                       ✓ 0
```

## 4. Files changed

```
server/.../workflow/WorkflowQueueStream.java             (new) — SSE fan-out +
                                                                  event listeners
server/.../web/CaptureWorkflowController.java            — + GET /queue/stream +
                                                            deviceId query param
server/.../security/SecurityConfig.java                  — /queue/stream authenticated
server/.../web/CaptureWorkflowControllerTest.java        — + WorkflowQueueStream MockBean
admin-ui/src/api/edgeApi.ts                              — workflowQueue(deviceId)
admin-ui/src/screens/workflow/WorkflowQueue.tsx          — EventSource, device filter,
                                                            StreamBadge, 60 s safety-net
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.24
```

## 5. What this still doesn't do

- Enforcement — a device-bound step is still visible to anyone who
  knows to pass `?deviceId=<it>`. True device authentication (the
  device-level principal plumbing shipped under the DER-MSG stack
  for peer messaging) will later let the server auto-scope the queue
  without the client having to supply the id.
- Per-user filtering — ADMINs still see every row by role gate. A
  future per-user "my work" variant would combine `ownerDeviceId`
  with a user-device assignment table.

## 6. Build + test

```
mvn test -Dtest=CaptureWorkflowControllerTest   ✓ 20/20
mvn -q -DskipTests package                      ✓ 2.3.24 JAR
tsc -b && vite build                            ✓
admin-ui unit tests                             241/245 (4 pre-existing baseline)
End-to-end SSE + device filter                  ✓ 23 ms push latency
```
