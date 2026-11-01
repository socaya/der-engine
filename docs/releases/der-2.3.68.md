# der-2.3.68 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.67`

## Headline

**Topology — DHIS2 Central moves to the top-centre, no edge crosses
the DER↔DHIS2 sync line, per-traffic-class edge colours.**

## 1. Layout

- **WAN (central DHIS2)** moved from upper-right offset to directly
  above DER on the vertical centreline. The DER↔WAN sync edge is
  now the dominant vertical uplink.
- Device slot 0 (top-centre) retired. Six device slots now sit on
  the lateral + southern arc only — upper-right · east ·
  lower-right · lower-left · west · upper-left. Any device that
  previously occupied the top slot (e.g. Community Device) auto-
  reflows into one of the six.
- Peer slots moved below DER's equator so peer edges never cross
  the DER↔WAN vertical.

Result: nothing crosses the DER↔DHIS2 sync line.

## 2. Edge styling by traffic class

Different traffic types read as different colours, dash patterns,
particle counts, and cadences so admins recognise flow classes at
a glance:

| Type | Colour | Line | Particles | Cadence |
|---|---|---|---|---|
| **wan** (DER ↔ DHIS2 sync) | navy | 2.5 px solid | **2** | slow (1.3×) |
| **p2p** (peer exchange) | teal | 1.75 px dashed | 1 | medium (1.1×) |
| **wifi** | amber | 1.5 px solid | 1 | fast (0.8×) |
| **ethernet** (LAN) | forest-green | 1.5 px solid | 1 | medium (0.9×) |
| **offline / degraded** | status tone | dashed | 0 particles | — |

WAN's two particles start with a phase offset so they spread along
the edge instead of stacking — reads as continuous bidirectional
sync. Offline / degraded edges suppress particles so the eye lands
on the warning line, not a stale "flow" cue.

## 3. KPI strip removed

The 5-tile KPI row (DER status · DHIS2 · Local database ·
Synchronisation · Client devices) is gone. Each tile wrapped a card
around a fact that already lives either in the hero chip or in a
module overview (`/dhis2`, `/system/information`, `/sync`, `/devices`).

Workspace is now a clean three-section landing:

```
Hero          — status chip · version · reliability · conflicts chip
Topology      — live mesh canvas with directional + animated edges
Three-up row  — Devices · Workflows · Storage donut
```

Also dropped the per-tile SVG icons + the WorkerHealth state fetch
that were only used by the strip.

## 4. Workflow catalogue — binding display names

Catalogue rows resolve `PROGRAM:UID` / `DATA_SET:UID` strings to
display names via `md.fetchMetadataName` (DER mirror → offline-safe).
De-duplicated so N workflows on the same program fire one fetch:

```
PEP Prevention HIV Programme   ← resolved display name
Program · ypERhZSScUZ          ← kind + UID in muted sub-text
```

## 5. Monitoring row drill-ins

Business-key cells on Blockages / Pending conflicts / Drafts
panels (and the Recent-activity feed + Issues "Message" cells)
link into the admin run detail (`/workflows/monitoring/runs/{runId}`)
instead of the workflow definition.

## 6. Files changed

```
admin-ui/src/components/network/NetworkConnection.tsx      — per-type colour + cadence +
                                                               particle count + arrow head
admin-ui/src/components/network/topologyLayout.ts          — WAN top-centre;
                                                               6 device slots on
                                                               lateral + southern arc;
                                                               peer slots moved south
admin-ui/src/screens/Workspace.tsx                          — drop KPI strip + mesh embed
admin-ui/src/screens/shared.tsx                            — Donut helper
admin-ui/src/screens/EACoreScreens.tsx                     — resolve catalogue binding
                                                               names
admin-ui/src/screens/workflow/WorkflowMonitoring.tsx       — business-key links →
                                                               /workflows/monitoring/runs/{runId}
admin-ui/src/screens/workflow/WorkflowRunDetail.tsx         (new in 2.3.66)
admin-ui/src/styles.css                                     — modern KPI tiles,
                                                               mesh height cap,
                                                               run detail contrib styles
VERSION / server/pom.xml / admin-ui/package.json / sw.js   — 2.3.68
```

## 7. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.68 bundle
cd server   && mvn -q -DskipTests package   ✓ der-server-2.3.68.jar (no code change
                                               since the 2.3.66 drafts endpoint)
```

Live stack is still 2.3.66; this is admin-UI only.

## 8. Follow-ups

- Remove remote-edge (DER-to-DER) peer connections entirely —
  pilot scope is Devices → DER Edge → DHIS2 only for now.
- Keyboard navigation on the inner-sidebar Monitoring rail.
- Section-local refresh buttons on Monitoring.
