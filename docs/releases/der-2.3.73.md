# der-2.3.73 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.72`

## Headline

**Internet status now auto-randomises in real time (Simulate on by
default) so a stationary demo shows the edge-first LAN-still-works
concept without anyone clicking.**

## 1. Truthful by default, simulated only on dev/CI boxes

In 2.3.72 the pill on the Internet node was a manual on/off switch.
That meant a reviewer walking up to the dashboard saw a frozen
state — no sense of what happens *when* a drop occurs. In 2.3.73
the pill is a **Simulate** toggle whose **default is driven by the
server**, so production shows reality and demo rigs show the demo:

- **On real pilot deployments** (`wan.centralIsLocal = false`) —
  Simulate is **OFF** by default. The Internet node reflects the
  live `wan.internetAvailable` probe exactly. Operators can still
  flip Simulate on manually for a walkthrough.
- **On dev / CI / co-located boxes** (`wan.centralIsLocal = true`)
  — Simulate is **ON** by default. A local timer flips the
  Internet state on a random schedule because the probe would
  otherwise be stuck at "up" (both DHIS2 and DER on loopback) and
  the operator could never see the edge-first behaviour.

Up-time ∈ [25, 60] s, down-time ∈ [6, 15] s, mimicking a real
uplink with occasional short drops in an otherwise-OK link:

- sustained WAN flows for ~half a minute,
- a sudden red drop + static WAN column for a few seconds,
- device↔DER + device↔device LAN flows **never stop**,
- the uplink restores itself and WAN flow resumes.

While Simulate is engaged a small `· sim` chip appears next to the
ON/OFF label so it's always obvious the state is a simulator value
and not the real probe.

### Server-side detection

`NetworkTopologyService` now adds `wan.centralIsLocal: boolean` to
the `/edge-api/v1/network/mesh/topology` payload. It reads the
active `Dhis2ConnectionConfig` and returns true when the base URL
contains loopback, `der.local`, or any `*.local` hostname. Returns
false (truthful mode) for any other URL, including unresolved
hostnames — fail-safe towards truth.

## 2. Visual tweaks

- The pill is slightly smaller (28 × 14 vs 32 × 16) and switches
  colour from status-tone to **primary blue** so it reads as a
  dashboard-control pill, not a status badge. Grey when Simulate
  is off.
- A tiny **"sim"** caption below the pill self-labels the control.

## 3. State model

```
simulate: boolean              // user-controlled (default: true)
simOnline: boolean             // auto-flipped by setTimeout chain
                               // when simulate === true
internetOnline = simulate ? simOnline : wan.internetAvailable
```

The timer cleans itself up when the component unmounts or when
Simulate is turned off. Switching Simulate off while OFFLINE
immediately snaps back to the real probe value — no stale red
state leaks through.

## 4. Files changed

```
server/.../network/NetworkTopologyService.java           — new centralIsLocal()
                                                             + wan.centralIsLocal
                                                             in payload
admin-ui/src/components/network/types.ts                 — WanInfo.centralIsLocal
admin-ui/src/components/network/TopologyCanvas.tsx       — useRef/useEffect
                                                             simulator;
                                                             simulate default =
                                                             wan.centralIsLocal
admin-ui/src/components/network/NetworkNode.tsx          — Simulate pill
                                                             + "sim" caption;
                                                             state chip reads · sim
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.73
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.73 bundle (798 ms)
cd server   && mvn -q -DskipTests package   ✓ der-server-2.3.73.jar (61.8 MB)
Swap live:
  pkill der-server-2.3                       ✓ 2.3.72 stopped
  java -jar target/der-server-2.3.73.jar     ✓ Started in 2.09 s
  https://der.local/edge-api/v1/system/health → 200
```

## 6. Follow-ups

- Reviewer-friendly settings: let the operator pick the up/down
  dwell ranges from a config icon on the Internet node.
- Workflow-service-point driven routing — particles follow the
  defined handoff sequence instead of animating every live edge.
- Pre-existing CWF-01 RowMenu delete tests (4 failures, unrelated).
