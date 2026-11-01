# der-2.3.67 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.66`

## Headline

**Workspace Topology → live mesh canvas · modern KPI tiles · catalogue
binding names.** Three admin-UI polish items landing together.

## 1. Topology panel uses the live mesh canvas

Dropped the three-node linear mock (`DHIS2 Central → DER → Clients`
with a wrong-direction arrow) in favour of the full
`TopologyCanvas` SVG renderer that powers `/network/mesh`. The
embed:

- Pulls `GET /edge-api/v1/network/mesh/topology` every 30 s via
  `useMeshTopology`.
- Draws proper bidirectional edges, device + peer cards, and the
  WAN bubble — same style as the full page.
- Panel header gains a *View full mesh* link to the detailed
  `/network/mesh` view.
- Canvas height capped at 420 px when embedded so the dashboard
  stays scannable; the full-page mesh keeps the 760 px cap.

Removed the now-unused `TopoNode` / `TopoArrow` helpers from
`Workspace.tsx`.

## 2. KPI tiles — modern DER dashboard idiom

Reskinned the 5 top-row tiles (DER / DHIS2 / DB / Sync / Devices)
to match the standard DER modern-dashboard look:

- **3 px tone-coloured left-accent** per state (success / warning /
  danger / info) so each tile reads at a glance.
- **Icon in a 36 px tone-tinted circle** instead of a bare glyph.
- **Value colour mirrors the tile tone** — "Live" renders green,
  "Unreachable" renders red — no need to read the caption to tell
  state.
- Value size trimmed to 20 px, caption gap tightened for balance.

## 3. Workflow management catalogue — binding display names

The catalogue (`/workflows/manage`) was rendering raw UIDs in the
Binding column (`PROGRAM:ypERhZSScUZ`). Reload now dedup-fetches
each unique binding UID via `md.fetchMetadataName` (DER mirror,
offline-safe) and renders:

```
PEP Prevention HIV Programme     ← resolved display name
Program · ypERhZSScUZ             ← kind + UID in muted sub-text
```

Falls back to the raw UID if the mirror lacks the entry.

## 4. Files changed

```
admin-ui/src/screens/Workspace.tsx          — TopologyCanvas embed +
                                                useMeshTopology hook;
                                                drop TopoNode/TopoArrow helpers
admin-ui/src/screens/EACoreScreens.tsx      — resolve binding names in
                                                EACaptureWorkflowList
admin-ui/src/styles.css                      — modernised .ea-kpi-tile tones;
                                                .ea-ws-mesh height cap
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.67
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.67 bundle
cd server   && mvn -q -DskipTests package   ✓ der-server-2.3.67.jar (no code change)
```

Live server stays on `der-server-2.3.66.jar`; this release is
admin-UI only.
