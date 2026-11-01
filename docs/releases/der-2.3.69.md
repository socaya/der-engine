# der-2.3.69 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.68`

## Headline

**Pilot scope: Devices → DER → DHIS2 (peers suppressed) + bidirectional
animated edges.**

## 1. Peer edges removed from topology

Pilot scope narrowed. Workflows + topology surfaces assume Devices
→ DER → DHIS2 only; DER-to-DER peer exchange is deferred.

- `TopologyCanvas` no longer renders peer cards or peer edges.
  Connections filtered by `type !== 'p2p'`; peer layout call
  dropped. The server may still return peer rows; the view simply
  ignores them.
- `NetworkLegend` legend reskinned — swap the old generic *LAN* +
  *P2P* chips for class-specific chips matching the new edge
  colours: **Sync** (navy, DER↔DHIS2), **Ethernet** (forest),
  **Wi-Fi** (amber).
- `NetworkSummary` Peers row removed; renamed WAN row to **DHIS2**.
- Admin fleet-sharing peer management (`/network/workflow-sharing`)
  remains for discovery but has no visual effect on the mesh.

## 2. Bidirectional data flow

Every live edge now animates particles in **both directions**:

| Type | Forward particles | Reverse particles |
|---|---|---|
| **wan** (DER ↔ DHIS2) | 2 | 2 |
| **ethernet** / **wifi** | 1 | 1 |
| **offline / degraded** | 0 | 0 |

Reverse particles are slightly smaller (2 px vs 2.5 px for LAN;
2.5 px vs 3 px for WAN) and 0.75 opacity so the forward direction
stays dominant visually, but admins can see that device uplinks
carry contributions in and prefetch cues out, and that WAN sync
pulls metadata and pushes data in the same breath. Phase offsets
start the reverse pass at `-0.5 × cadence` so forward + reverse
dots don't collide at the midpoint.

## 3. Files changed

```
admin-ui/src/components/network/NetworkConnection.tsx     — reverseParticles per type
                                                              + opacity 0.75;
                                                              phase offset
admin-ui/src/components/network/TopologyCanvas.tsx        — drop peer layout +
                                                              cards; filter p2p edges
admin-ui/src/components/network/NetworkLegend.tsx         — Sync / Ethernet / Wi-Fi
                                                              chips replace LAN / P2P
admin-ui/src/components/network/NetworkSummary.tsx        — Peers row removed;
                                                              WAN row → DHIS2
VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.69
```

## 4. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.69 bundle
cd server   && mvn -q -DskipTests package   ✓ der-server-2.3.69.jar (no code change)
```

Admin-UI only; server identical to 2.3.66.

## 5. Follow-ups

- Keyboard navigation on the inner-sidebar Monitoring rail.
- Section-local refresh buttons on Monitoring.
- `NetworkNodeDetails` still has peer-aware code paths — tidy once
  the pilot pattern settles.
