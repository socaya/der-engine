# der-2.1.67 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.66`

## Headline

Two correctness fixes for the runtime indicator surfaced by the
2.1.66 offline-resilience sweep:

1. **DER health endpoint reports `UP` instead of `starter-ready`.**
   The former value was a Phase 00 placeholder that never
   transitioned; the UI's "Starting" label stuck forever as a
   result.
2. **New `/edge-api/v1/dhis2/ping` endpoint drives the live
   central-reachability signal** instead of the stale compat
   snapshot. The topbar runtime indicator, the Pull-metadata
   button disabled-state, and the sidebar footer now all flip
   from "Connected" to "Offline-First" within 15 s of Central
   dropping (and back again within 15 s of Central returning).

## 1. Server — health status

`SystemController.health()` returned `"starter-ready"` from day
one. That value matched *both* `derUp` and `starting` branches of
the UI's state machine, so the UI concluded "DER is up AND still
starting" — the "Starting" label would never clear.

```java
// was
return new SystemHealthResponse("der-server", "starter-ready", …);
// now
return new SystemHealthResponse("der-server", "UP", …);
```

By the time this controller services a request the Spring context
is fully up, so `"UP"` is honest. The former value is still
tolerated client-side (as a legacy `derUp` match) so a mixed-
version fleet continues to work during a rollout.

## 2. Server — lightweight ping endpoint

Problem: `/edge-api/v1/compat` returned the last-known-good
compat snapshot — only refreshed by the daily cron at 03:00 or by
an explicit `POST /compat/refresh`. So after Central dropped the
UI kept seeing `probeReachable: true` for hours.

Fix: new `GET /edge-api/v1/dhis2/ping` endpoint on
`Dhis2CompatibilityController`:

- Does a short-timeout `GET /api/system/info` against Central.
- Caches the result for **10 s** via an `AtomicReference` so a
  burst of UI polls doesn't fan out to Central.
- Response:
  ```json
  { "reachable": true, "observedVersion": "2.44-SNAPSHOT",
    "latencyMs": 108, "probedAt": "2026-10-28T13:34:33Z",
    "message": null }
  ```
- Reachable:false carries the actual error:
  ```json
  { "reachable": false, "observedVersion": null,
    "latencyMs": 1, "probedAt": "2026-10-28T13:34:50Z",
    "message": "I/O error contacting http://…:8080/dhis/api/system/info" }
  ```

Permission: `GET /edge-api/v1/dhis2/ping` is **authenticated**
(not ADMIN-only). Every logged-in operator needs the signal to
know whether Central is reachable; the surrounding `/dhis2/**`
admin-only policy is unchanged.

## 3. UI — hook rewrites

### `useRuntimeMode` (AdminShell)

Previously polled `edgeApi.health()` + `edgeApi.compat()` every
15 s. Now polls `edgeApi.health()` + `edgeApi.dhis2Ping()`.

- `derUp` match tightened to `"UP"` / `"ready"` (no longer
  accepts `"starter-ready"` as "up and done" — those paths flow
  through `starting` instead).
- Central-reachability sourced from the live ping, not the stale
  compat snapshot.
- Added `probing` state so the brief "no probe landed yet"
  window shows "Checking" instead of guessing "Offline-First".

### `useCentralReachable` (shared.tsx — new hook)

Polls `/dhis2/ping` every 15 s and returns `{ reachable, latencyMs,
message }`. Screens that need the live signal consume it directly:

- `SyncOverview` — "Pull metadata" and "Push data" disabled
  states now use the live reading, falling back to the compat
  snapshot only while the first ping response is in flight.

## Live verification — DHIS2 online → stopped → restarted

```
# Online (Tomcat up)
GET /edge-api/v1/dhis2/ping
→ { reachable: true, observedVersion: "2.44-SNAPSHOT", latencyMs: 108 }

# brew services stop tomcat@10
# wait 11 s for the 10 s cache to expire
GET /edge-api/v1/dhis2/ping
→ { reachable: false, latencyMs: 1,
    message: "I/O error contacting http://…:8080/dhis/api/system/info" }
```

Playwright with Tomcat stopped (after a 16 s window for the UI
poll to catch up):

```
TOPBAR          : Offline-First           (was: stuck on "Starting")
FOOTER          : DER Offline-First · Central unavailable
Pull metadata   : disabled                (was: enabled)
```

Playwright after `brew services start tomcat@10`:

```
TOPBAR          : Connected
Pull metadata   : enabled
```

## Build + tests

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.67 JAR
```
