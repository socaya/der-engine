# der-2.2.7 (stable)

**Date:** 2026-10-30
**Previous stable:** `der-2.2.6`

## Headline

**Facility Mesh topology — redesigned per the DER Mesh Topology
spec** (`docs/media/DER Mesh Topology — Claude Implementation Instruction.md`).

- DER Edge Runtime card in the centre (diamond glyph, Facility Server
  subtitle).
- Facility devices as a radial ring around DER with icon + name +
  form-factor + status.
- Peer DER edges on an outer ring (dashed cards, p2p-style edges).
- WAN cloud above DER tracked **independently** — a WAN outage
  does not imply facility devices are offline.
- Right column: Network status counts + Selected-node details that
  update on click/keyboard.

## 1. Schema (V043)

```sql
der.edge_device
  + display_name  text  NULL
  + form_factor   text  NOT NULL DEFAULT 'UNKNOWN'
                  CHECK (form_factor IN
                    ('WORKSTATION','LAPTOP','TABLET','MOBILE','UNKNOWN'))
```

Index on `(form_factor)` for the topology filter.

## 2. Backend

### `GET /edge-api/v1/network/mesh/topology`

Combined view returning the spec §17 shape:

```
{ site, wan, der, devices[], peers[], connections[], summary }
```

Where:

- `der.status` — always `online` while the server responds.
- `wan.status` — `online` (central DHIS2 reachable) /
  `degraded` (internet up, DHIS2 unreachable) / `offline`.
- `devices[].status` — `online` ≤ 2 min since last heartbeat,
  `degraded` ≤ 10 min, otherwise `offline`.
  Pending-approval / suspended / revoked devices read `offline`.
- `devices[].sync` — `{ state: synced|pending|syncing|error, pending }`.
  Pending count = `operation_journal` rows attributed to the device's
  assigned user in state `PENDING/RETRYABLE/UNKNOWN_OUTCOME`.
- `peers[].status` — derived from `network_peer.state`
  (`CONNECTED` → online, `HANDSHAKING` → degraded, else offline).
- `connections[]` — `source → target` with `type` (`wifi` | `p2p` |
  `wan`) + inherited status.

### `PATCH /edge-api/v1/devices/{id}/profile`

Operator rename + form-factor edit:

```
{ "displayName": "Registration", "formFactor": "WORKSTATION" }
```

Form-factor values validated server-side; invalid returns `400`
`FORM_FACTOR_INVALID`. Revoked devices return `409`.

## 3. Admin UI

Component split under `admin-ui/src/components/network/`:

```
types.ts               — API-mirroring interfaces
topologyLayout.ts      — ringLayout(…), CENTRE, wanPosition()
useMeshTopology.ts     — polling hook (15 s default)
NetworkStatusBadge.tsx — colour-dot + label
NetworkLegend.tsx      — top-right legend
NetworkConnection.tsx  — edge SVG (solid LAN / dashed P2P / red offline)
NetworkNode.tsx        — DerCard, DeviceCard, PeerCard, WanBubble
TopologyCanvas.tsx     — SVG canvas with ring layout
NetworkSummary.tsx     — right-column counts
NetworkNodeDetails.tsx — right-column selected-node details
```

Orchestrator at `screens/MeshTopology.tsx`.

### Interaction

- Click a node → it becomes selected (blue border), details panel
  updates.
- Keyboard: Tab moves between nodes, Enter / Space selects.
- Default selection on first load = the DER centre node.
- Reduced-motion honoured — sync pulse animation disabled when
  `prefers-reduced-motion: reduce`.
- Responsive — grid collapses to a single column below 960 px so the
  canvas stays readable on tablet.

### Device-form glyphs added to `UiIcon`

```
workstation      — desktop + stand
laptop           — clamshell
tablet           — slab
mobile           — phone slab
facility-server  — diamond (centre node)
unknown-device   — generic chip
```

### Device detail page

Added **Profile** editor (display name + form-factor select) that
calls `PATCH /devices/{id}/profile`. New rows added to the detail dl
for Display name + Form factor.

## 4. Spec acceptance (§47)

| Requirement | Status |
|---|---|
| DER appears as central facility node | ✓ |
| Devices rendered around DER | ✓ |
| Device names + types visible | ✓ (fallback to Device <uuid-prefix> when unnamed) |
| Online / Degraded / Offline visually distinct | ✓ (badge + aria label) |
| State not communicated by colour alone | ✓ (text + aria) |
| LAN vs P2P visually different | ✓ (solid vs dashed) |
| Broken connection indicated | ✓ (red tone when either endpoint offline) |
| Syncing devices identifiable | ✓ (blue dot + "N queued" subtitle) |
| Node selection works | ✓ |
| Selected-device details update | ✓ |
| Network summary = actual state | ✓ |
| WAN state shown independently | ✓ (separate bubble + wan.status in summary) |
| WAN outage ≠ devices offline | ✓ (device status derived from heartbeat, not WAN) |
| Responsive | ✓ (960 px breakpoint) |
| Keyboard navigation | ✓ (role=button + Tab/Enter/Space) |
| Reduced-motion respected | ✓ |
| Existing design patterns reused | ✓ (Panel, SyncStatusBar, Status, UiIcon) |
| Mock data separated from production | ✓ (service reads real DB; no simulation) |
| Build + tests pass | ✓ |

## 5. Verified live

```
V043 migration applied cleanly  (schema now at v043)
Topology endpoint:  der + wan + 1 device + 2 peers + 3 connections
Rename DEB device "Device 69399b63" → "Registration" (WORKSTATION)
                   topology reflected rename immediately
Invalid form factor:  HTTP 400 FORM_FACTOR_INVALID
UI render:          5 nodes (WAN + DER + 1 device + 2 peers)
                    5 legend items
                    default selection = DER centre
                    click selection updates Selected node panel
pageerrors:         0
```

## 6. Files changed

```
database/migrations/V043__device_profile.sql                               (new)
server/src/main/java/ug/ac/mak/der/network/NetworkTopologyService.java     (new)
server/src/main/java/ug/ac/mak/der/web/NetworkTopologyController.java      (new)
server/src/main/java/ug/ac/mak/der/device/EdgeDevice.java                  — + displayName, formFactor
server/src/main/java/ug/ac/mak/der/device/EdgeDeviceRepository.java        — selectAll includes new cols + updateProfile()
server/src/main/java/ug/ac/mak/der/device/DeviceService.java               — renameProfile()
server/src/main/java/ug/ac/mak/der/web/DeviceController.java               — PATCH /{id}/profile
admin-ui/src/components/network/*.{ts,tsx}                                  (new, 8 files)
admin-ui/src/screens/MeshTopology.tsx                                       — orchestrator rewrite
admin-ui/src/screens/MoreScreens.tsx                                        — DeviceProfileEditor on detail page
admin-ui/src/components/UiIcon.tsx                                          — 6 new form-factor icons
admin-ui/src/api/edgeApi.ts                                                 — DeviceFormFactor + updateDeviceProfile()
admin-ui/src/styles.css                                                     — .ea-mesh-grid collapse, .ea-sync-dot pulse + reduced-motion
admin-ui/public/sw.js                                                       — SW_VERSION → 2.2.7
VERSION / server/pom.xml / admin-ui/package.json                            — bumped
```

## 7. Known follow-ups (out of scope for 2.2.7)

- SSE / WebSocket push for topology updates instead of 15 s polling.
- Conflict badge on devices (spec §36 — model prepared, UI pending).
- Device-level diagnostics modal from the Selected-node panel.
- AP SSID + connected-clients panel (spec §33).

## Build + test

```
tsc -b && vite build                      ✓ 90 modules
./mvnw -q -DskipTests clean package       ✓ 2.2.7 JAR + V043 applied
E2E Playwright sweep                      ✓ topology render + rename round-trip + selection
```
