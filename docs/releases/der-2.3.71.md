# der-2.3.71 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.70`

## Headline

**Internet node now reads as a facility switch/router + strict
device-online gating: offline devices show static edges, no flow.**

## 1. Internet glyph

The oval "cloud" bubble between DER and DHIS2 Central is replaced
with a rectangular network-switch card using the new `router` icon:

- `UiIcon` vocabulary extended with a `'router'` glyph — slim
  rack-style box with four port LEDs on top and bidirectional
  traffic arrows on the sides. Reads unmistakably as a network
  gateway, not a generic device or a weather cloud.
- `InternetBubble` reshaped to a 150 × 56 rounded rectangle (same
  dimensions as a device card) with the router icon left + text
  stack right (`Internet` title, green/red dot + `ON`/`OFF`).
- Stroke colour switches between `--der-success-ink` (ON) and
  `--der-danger-ink` (OFF). Selected state overrides to the primary
  blue so the selection ring stays consistent with every other node.

## 2. Strict device-online flow gating

Flow resolution tightened in `TopologyCanvas.resolveFlow`. An edge
only animates when **every endpoint is actually online**:

| Scenario | Flow |
|---|---|
| Edge `status === 'online'` AND both endpoints online | **full** |
| Edge `status === 'degraded'` AND both endpoints online | **dim** |
| Edge `status === 'offline'` | **none** |
| Either endpoint offline (device, DER, or WAN) | **none** |
| Device enrolment APPROVED but heartbeat stale | **none** |

The previous "dim flow for APPROVED-but-stale device" rule is gone.
Clinical reality: no packets leave an offline device, so no
particles should either. Admins now see a dead-still static line
whenever a device drops off the LAN, same as a plug pulled out.

This applies uniformly to:

- Device ↔ DER edges (each device's own uplink).
- Device ↔ Device p2p edges (short-range WiFi Direct / Bluetooth
  links) — both endpoints must be online for the hop to flow.
- DER ↔ Internet / Internet ↔ DHIS2 — WAN column still keyed off
  `wan.internetAvailable` and `wan.status` as of 2.3.70.

## 3. Files changed

```
admin-ui/src/components/UiIcon.tsx                       — add 'router' glyph
admin-ui/src/components/network/NetworkNode.tsx          — InternetBubble reshape (card + icon)
admin-ui/src/components/network/TopologyCanvas.tsx       — resolveFlow enforces
                                                             both-endpoints-online
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.71
```

## 4. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.71 bundle (800 ms)
cd admin-ui && npm test                     ✓ 245/249 pass; 4 failing are
                                              pre-existing CWF-01 RowMenu
                                              delete tests unrelated to this change
```

Admin-UI only; server identical to 2.3.66.

## 5. Follow-ups

- Workflow-service-point driven routing — particles follow the
  defined handoff sequence (Registration → Triage → …) instead of
  animating every live edge equally.
- Keyboard navigation on the Monitoring inner-sidebar rail.
- Dedicated `NetworkNodeDetails` panel for the Internet switch
  (currently reuses the WAN panel when clicked).
- Fix pre-existing CWF-01 RowMenu delete tests.
