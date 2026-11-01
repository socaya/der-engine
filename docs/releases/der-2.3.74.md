# der-2.3.74 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.73`

## Headline

**Internet simulator control moved out of the topology card into
Settings — Workspace stays clean, preference persists, Auto detects
localhost regardless of port.**

## 1. Settings home for the simulator

The `Simulate` pill + "sim" caption on the Internet node are gone.
In their place a **Demo & simulation** section lives on
`/settings` (EA-36) with three radio options:

- **Auto** (default) — simulate iff DHIS2 Central is a local URL.
  `localhost`, `127.0.0.1`, `[::1]`, `der.local`, or any `*.local`
  host triggers it; port numbers do not matter so
  `http://localhost:8080` and `http://localhost:9999` both qualify.
- **Always on** — cycle the state regardless of probe. Use for a
  walkthrough on real pilot hardware where the uplink is actually
  healthy.
- **Off** — never simulate; show the live server probe truthfully.

The preference is persisted to `localStorage` under
`der.demo.internetSimulate` and distributed through a tiny pub/sub
module so the Workspace topology reacts live when you change the
mode in Settings (no reload needed).

## 2. Topology card now purely a status surface

`InternetBubble` lost its toggle plumbing. It renders the router
glyph, the Internet label, a green/red dot + ON/OFF, and a quiet
`· sim` chip when the simulator is driving the value. Clicking the
card opens the WAN details drawer, same as before.

## 3. State flow

```
EASettings  ──writes──▶  simulateStore (localStorage) ──pub/sub──▶  TopologyCanvas
                                                                   │
                                                                   ▼
                                                 useSyncExternalStore(mode)
                                                 simulate = resolveSimulate(
                                                   mode, wan.centralIsLocal)
```

Server-side `wan.centralIsLocal` from 2.3.73 is unchanged and still
feeds the Auto decision.

## 4. Files changed

```
admin-ui/src/features/demo/simulateStore.ts              — NEW; pub/sub preference
                                                             (modes: auto/on/off)
admin-ui/src/components/network/TopologyCanvas.tsx       — subscribes to the store;
                                                             no toggle state
admin-ui/src/components/network/NetworkNode.tsx          — InternetBubble: toggle
                                                             removed; `simulated`
                                                             prop drives · sim chip
admin-ui/src/screens/EARemainderScreens.tsx              — new
                                                             InternetSimulatePreference
                                                             radio group inside
                                                             EASettings
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.74
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.74 bundle (850 ms)
cd admin-ui && npm test                     ✓ 245/249 pass (4 pre-existing
                                              CWF-01 RowMenu delete failures
                                              unrelated to this change)
```

## 6. Follow-ups

- Expose up/down dwell ranges in Settings if operators want to
  tune the simulator cadence per site.
- Pre-existing CWF-01 RowMenu delete tests.
