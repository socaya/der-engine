# der-2.3.72 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.71`

## Headline

**Interactive Internet ON/OFF switch — admins can intentionally cut
DER↔DHIS2 to demonstrate the edge-first offline-capable concept.**

## 1. The toggle

The Internet node now shows a real toggle switch on its right edge:

```
┌────────────────────────────────┐
│  [router]  Internet            │
│            ● ON · manual   ◉━━ │   ← pill toggle (green/thumb-right)
└────────────────────────────────┘
```

- Click the pill to flip ON → OFF (or OFF → ON). Enter/Space work
  from keyboard; the toggle exposes `role="switch"` and
  `aria-checked` for screen readers.
- `stopPropagation` keeps the surrounding card's node-select click
  from firing when the toggle is used — card body still opens the
  details drawer when clicked outside the switch.
- When the operator-driven state diverges from the server probe a
  **`· manual`** chip appears under the status label, so you can
  tell "the server says Internet is up but someone pulled the plug
  in the demo" apart from "the probe actually failed".

## 2. What the toggle controls

| Toggle | DER → Internet edge | Internet → DHIS2 edge | Device ↔ DER | Device ↔ Device |
|---|---|---|---|---|
| **ON** (default = server probe) | animates | animates (if WAN endpoint ok) | per device status | per device status |
| **OFF** (operator override) | **static, no flow** | **static, no flow** | per device status | per device status |

The LAN tier is **not** affected — device heartbeats + enrolment
state still drive those edges exactly as before (strict online
gating from 2.3.71). This is the point: cutting the uplink proves
DER keeps capturing data on the LAN side.

## 3. State model

- `TopologyCanvas` holds `internetOverride: boolean | null`.
- `null` → follow server (`wan.internetAvailable`).
- `true` / `false` → operator override; survives subsequent polls.
- A single click flips between the two states; a page reload clears
  the override (deliberately — it's a demo switch, not a saved
  flag).

The server WAN probe keeps running and populating the panel detail
drawer; the override only affects the canvas rendering.

## 4. Files changed

```
admin-ui/src/components/network/NetworkNode.tsx          — InternetBubble: SVG toggle
                                                             + stopPropagation
                                                             + 'manual' override chip
admin-ui/src/components/network/TopologyCanvas.tsx       — useState override;
                                                             internetOnline derives
                                                             from override ?? probe
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.72
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.72 bundle (780 ms)
```

Admin-UI only; server identical to 2.3.66.

## 6. Follow-ups

- Persist the override through a page reload if operators want it
  (currently a session-only demo switch).
- Workflow-service-point driven routing — particles follow the
  defined handoff sequence instead of animating every live edge.
- Keyboard navigation on the Monitoring inner-sidebar rail.
