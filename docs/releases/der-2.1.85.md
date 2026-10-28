# der-2.1.85 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.84`

## Headline

New top-level **Network** module per the DER Network Module
Design Specification (`docs/requirements/DER_Network_Module_Design_Specification.md`).
Eight native sub-pages wired into the admin shell, matching
the specification's §24 navigation shape.

```
Sidebar
───────
Overview
DHIS2
Synchronisation
Network        ← new (wifi glyph)
Workflows
Data
Administration
System
Security & Audit
Settings
```

## 1. Sub-pages

| Route | Component | SyncStatusBar status |
|---|---|---|
| `/network` | `NetworkOverview` | `DER Network · Connected` |
| `/network/access-point` | `NetworkAccessPoint` | `Access Point · Not reporting` |
| `/network/clients` | `NetworkConnectedDevices` | `Connected Devices · 0 on network` |
| `/network/interfaces` | `NetworkInterfaces` | `Interfaces · 0 up / 0` |
| `/network/peers` | `NetworkPeers` | `Peers · 0 configured` |
| `/network/security` | `NetworkSecurity` | `Network security · Client isolation on` |
| `/network/diagnostics` | `NetworkDiagnostics` | `Network diagnostics · Service pending` |
| `/network/settings` | `NetworkSettings` | `Network settings · Read-only` |

Routing lives at `admin-ui/src/App.tsx` lines 60-67.
Section tabs come from the `Network` NavGroup entry in
`admin-ui/src/app/navigation.ts`.

## 2. Overview page

Six click-through facet cards laid out in a responsive
`.ea-net-grid` (CSS grid, `minmax(220px, 1fr)` × 3):

```
┌──────────────┐┌──────────────┐┌──────────────┐
│ 📡 AP        ││ 👥 Clients  ││ ↔ Interfaces│
│ Not reporting││ 0 on network ││ 0 up / 0     │
│ Access Point ││ Connected    ││ Interfaces   │
└──────────────┘└──────────────┘└──────────────┘
┌──────────────┐┌──────────────┐┌──────────────┐
│ ⬢ Peers      ││ 🔒 Firewall ││ 🧭 Central  │
│ 0 configured ││ Default-deny ││ Reachable    │
│ Peers        ││ Security     ││ DHIS2        │
└──────────────┘└──────────────┘└──────────────┘
```

Each facet card is a `<Link>` to its sub-page, tone-coloured
via `data-tone` (success / warning / critical / neutral). The
central-DHIS2 facet re-uses `useCentralReachable()` so it
tracks the shared `/edge-api/v1/dhis2/ping` state.

## 3. Pending-service hint (graceful empty state)

The design spec is Phase N1-N3: the server side (`/edge-api/v1/network/*`)
is scheduled for a later release. Until it lands, the client
calls fail (all four endpoints return 401/404). The overview
now treats that as **"service pending"** instead of
**"network probe failed · invalid credentials"**:

```tsx
async function reload() {
  const results = await Promise.allSettled([
    edgeApi.networkStatus(), edgeApi.networkAccessPoint(),
    edgeApi.networkEvents(10), edgeApi.networkClients(),
  ]);
  // apply any successful result
  const anySuccess = results.some((r) => r.status === 'fulfilled');
  setServicePending(!anySuccess);          // show hint, not error
}
```

Renders a muted `.ea-state-block`:

```
┌─────────────────────────────────────────────────┐
│ 📡  Network service pending                     │
│                                                 │
│     The /edge-api/v1/network/* endpoints are    │
│     scheduled for Phase N1-N3. Once the service │
│     is enabled the page will populate with live │
│     data.                                       │
└─────────────────────────────────────────────────┘
```

The seven sub-pages render their SyncStatusBar + the same
pending block, so operators can navigate the full module
layout today and see the shape of what will be live when
the agent is deployed.

## 4. New vocabulary

### UiIcon

`admin-ui/src/components/UiIcon.tsx` gains six network glyphs:
`wifi`, `access-point`, `ethernet`, `firewall`, `peer`, `route`.
All `stroke="currentColor"`, 16 × 16 default, so they pick up
`.ea-chip`, `.ea-status`, and button tones automatically.

### CSS

`admin-ui/src/styles.css` adds:

```css
.ea-net-grid           { display:grid; gap:12px;
                         grid-template-columns:repeat(auto-fit,
                         minmax(220px, 1fr)); }
.ea-net-facet          { padding:14px; border:1px solid var(--der-border);
                         background:var(--der-surface); }
.ea-net-facet[data-tone="success"]  > .ea-net-facet-icon { color: var(--der-success-ink); }
.ea-net-facet[data-tone="warning"]  > .ea-net-facet-icon { color: var(--der-warning-ink); }
.ea-net-facet[data-tone="critical"] > .ea-net-facet-icon { color: var(--der-danger-ink); }
.ea-net-probe-path     { display:flex; gap:8px; flex-wrap:wrap; }
.ea-net-probe-step     { padding:6px 10px; border:1px solid var(--der-border);
                         display:inline-flex; gap:6px; align-items:center; }
```

### edgeApi

`admin-ui/src/api/edgeApi.ts` gains the Network type set and
seven read helpers (`networkStatus`, `networkInterfaces`,
`networkAccessPoint`, `networkClients`, `networkRoutes`,
`networkPeers`, `networkEvents`) plus five write helpers
(`networkApStart/Stop/RotateKey`, `networkDeviceApprove/Revoke`,
`networkPeerConnect/Disconnect`). The write helpers return
typed promises so the Phase N1 server can be wired without
UI changes.

## 5. Diagnostics page

Shows a Spec §28 probe-path visualiser:

```
Client ──→ AP ──→ DER host ──→ Central DHIS2
   ●          ●         ●              ●
                                  ping: 54 ms
```

Tone of each step comes from `.ea-net-probe-step[data-tone]`;
the final step takes its tone from the shared central-reachable
poll so it animates when connectivity changes.

## 6. Security page

Renders `FIREWALL_RULES` (constant mirroring Spec §14 default
policy — allow established-inbound, drop everything else) in a
read-only rule table. Flip to editable is Phase N1.

## 7. Settings page

Renders `DEFAULT_CONFIG` YAML (Spec §23) inside a monospace
block, labelled **Read-only**. Live edits are Phase N1.

## Live assertions

```
sidebar items: ["Overview","DHIS2","Synchronisation",
                "Network","Workflows","Data","Administration",
                "System","Security & Audit","Settings"]

/network             pending=true, errBlock=0, facetCount=6
/network/access-point  h1="Access Point · Not reporting"      errs=0
/network/clients       h1="Connected Devices · 0 on network"  errs=0
/network/interfaces    h1="Interfaces · 0 up / 0"             errs=0
/network/peers         h1="Peers · 0 configured"              errs=0
/network/security      h1="Network security · Client isolation on"  errs=0
/network/diagnostics   h1="Network diagnostics · Service pending"   errs=0
/network/settings      h1="Network settings · Read-only"           errs=0
```

Screenshot `/tmp/der-2.1.85-net-fixed.png` shows the Network
sidebar highlighted with the wifi glyph, eight section tabs
across the top, six facet cards in a 3 × 2 grid, and the
"Network service pending" muted hint underneath.

## 8. Scope boundaries

Phase N1 server endpoints (`/edge-api/v1/network/{status,interfaces,
access-point,clients,routes,peers,events}`) are **not** in this
release — only the native admin UI shell. The write helpers in
`edgeApi.ts` return typed promises so the backend can be wired
with zero UI change.

Deferred to Phase N1+:

- OpenWrt / RouterOS adapter in the DER agent process.
- Access-point mode toggle and rotate-key flow.
- Device-approve / device-revoke moderation queue.
- WireGuard peer provisioning.
- Live firewall rule editor.

## Build + test

```
tsc -b && vite build            ✓ 1759 modules
./mvnw -q -DskipTests package   ✓ 2.1.85 JAR built
Server serves 2.1.85             ✓
Playwright network sweep         ✓
```
