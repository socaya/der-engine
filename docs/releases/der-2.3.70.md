# der-2.3.70 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.69`

## Headline

**Internet gateway node between DER and DHIS2 Central — ON/OFF state
drives WAN flow suppression while LAN keeps running.**

## 1. New Internet bubble in the topology column

The DER↔DHIS2 Central vertical column now has three nodes stacked on
the centreline instead of two:

```
   ┌────────────┐
   │ DHIS2 Cent │   ← wanPosition()     (-310)
   └─────┬──────┘
         │  Internet → WAN edge
   ┌─────┴──────┐
   │  Internet  │   ← internetPosition() (-165)
   │   ○ ON     │
   └─────┬──────┘
         │  DER → Internet edge
   ┌─────┴──────┐
   │    DER     │   ← CENTRE
   └────────────┘
```

- `InternetBubble` (ellipse, rx 60 × ry 22) sits midway between DER
  and the DHIS2 cloud. Green stroke + green dot + "ON" when the
  server reports `wan.internetAvailable`; red + "OFF" when not.
- Status derives from the WAN probe payload only. The central DHIS2
  endpoint can still be degraded while Internet is up (misconfigured
  URL / expired credentials) — the two bubbles signal the two faults
  independently so admins can diagnose by the shape of the chain.

## 2. Flow suppression when Internet is OFF

The single `DER → WAN` edge is replaced by **two** edges with
independent flow states:

| Edge | Status source | Flow when Internet ON | Flow when Internet OFF |
|---|---|---|---|
| DER → Internet | `wan.internetAvailable` | **full** (animated) | **none** (static line) |
| Internet → DHIS2 Central | `wan.status` | full / dim / none per status | **none** |

Device → DER edges are **not** affected by Internet state — they key
off the device heartbeat + enrolment status as before. Admins see
LAN capture continue bidirectionally even while the WAN column goes
dark, which is the exact scenario the operator asked us to depict.

## 3. Layout change

- `wanPosition()` moved from y − 290 to **y − 310** to make room.
- `internetPosition()` added at y − 165, directly on the centreline.
- Device + peer slots unchanged — the top-centre arc remains
  reserved so no device/peer line crosses the WAN column.

## 4. Files changed

```
admin-ui/src/components/network/NetworkNode.tsx          — InternetBubble component
admin-ui/src/components/network/topologyLayout.ts        — wanPosition shift + internetPosition()
admin-ui/src/components/network/TopologyCanvas.tsx       — two-hop DER→Internet→WAN edges
                                                             + render InternetBubble;
                                                             flow prop suppresses WAN
                                                             column particles when offline
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.70
```

## 5. Verified

```
cd admin-ui && npm run build                ✓ 2.3.70 bundle (789 ms)
cd server   && mvn -q -DskipTests package   ✓ der-server-2.3.70.jar (no server change)
```

Admin-UI only; server identical to 2.3.66.

## 6. Follow-ups

- Workflow-service-point driven routing (particles follow the handoff
  sequence Registration → Triage → … per workflow definition).
- Keyboard navigation on the Monitoring inner-sidebar rail.
- `NetworkNodeDetails` dedicated panel for the Internet node (currently
  reuses the WAN panel when clicked).
