# der-2.1.91 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.90`

## Headline

Three threads land together:

1. **Fix the broken audit cross-links** — every Network row-menu
   "View audit" / "Full audit" link now resolves. The 5 `/security/audit?*`
   paths were pointing at a non-existent route. All are now
   rewritten to `/audit/events?*` and the audit page understands
   `peer`, `device`, `correlationId`, and `category=network` query
   params.
2. **Edit affordances across every Network sub-module** —
   per-record Edit dialogs with real backend persistence on AP,
   Clients, Interfaces, Peers, Security rules, and Settings.
3. **Security page polish** — rules get a full `Edit rule` dialog
   (position, source, destination, action, note) in addition to
   the single-click action-cycle shortcut.

## 1. Audit cross-links fixed

**Before** (broken — route didn't exist):

```
/security/audit?peer=740bd359-dc58-4b22-bb45-a84ef7be0aed  → blank screen
```

**Now:**

```
/audit/events?peer=740bd359-dc58-4b22-bb45-a84ef7be0aed
→ Network audit · 0 events (showing peer=740bd359… pill)
```

### Audit page gets a dual-mode `MockupAuditEvents`

```tsx
const networkMode = Boolean(category === 'network'
                             || deviceFilter || peerFilter || correlationId);

if (networkMode) {
  // Fetch /network/events (full shape per spec §29) + filter in-memory
} else {
  // Legacy /activity/recent sync-stream view
}
```

- Fetches `/edge-api/v1/network/events?limit=200` when any
  network filter is present.
- Filter pill strip above the table shows `peer=…`, `device=…`,
  `correlation=…`, `network` so operators see what's applied.
- **Clear filter** button links back to plain `/audit/events`.
- **Diagnostics** button links to `/network/diagnostics`.
- Table carries the full network event shape (interface + device /
  node + actor + outcome + reason) rather than the stripped-down
  activity feed.

### Fixed the 5 broken links

```
Clients  row-menu "View audit"       → /audit/events?device={id}
Peers    row-menu "View audit"       → /audit/events?peer={id}
Diagnostics event row "View correlation" → /audit/events?correlationId={id}
Diagnostics header   "Full audit"    → /audit/events?category=network
Security header      "View audit"    → /audit/events?category=network
```

## 2. Edit affordances across every sub-module

| Sub-module | New Edit flow |
|---|---|
| **Access Point** | **Edit AP** button in header → `ApEditDialog` (SSID / interface / band / channel / security / gateway / subnet) · writes to new `PUT /network/access-point` · `AP_CONFIG_UPDATED` audit |
| **Connected Devices** | Row-menu **Edit label** → `ClientLabelDialog` (owner / hostname) · `PUT /network/clients/{id}` · `DEVICE_LABEL_UPDATED` audit |
| **Interfaces** | Row-menu **Edit (priority / purpose)** → `InterfaceConfigDialog` · `PUT /network/interfaces/{name}` · `IFACE_CONFIG_UPDATED` audit · driver for Phase N4 failover |
| **Peers** | Row-menu **Edit peer** → `PeerDialog` in `mode='edit'` (nodeId / siteId / endpoint / publicKey / allowedIps) · `PUT /network/peers/{id}` · `PEER_UPDATED` audit |
| **Security** | Row-menu **Edit rule** → `PolicyDialog` in `mode='edit'` (position / source / destination / action / note) · existing `PUT /network/policy/{id}` expanded to accept all fields · `FIREWALL_RULE_UPDATED` audit |
| **Settings** | Row-menu **Edit** opens an inline input in the value cell — Enter to save, Cancel to abort · existing `PUT /network/settings/{key}` |

Each dialog shares the same shape (modal overlay + grid of labelled
inputs + Cancel / Save) so operators recognise the pattern across
sub-modules.

### Shared `add/edit` dialog pattern

`PolicyDialog` and `PeerDialog` both take a `mode: 'add' | 'edit'`
prop. In edit mode they prefill the inputs from the row object and
call the PUT endpoint on save. One component, two use cases — no
code duplication.

## 3. Settings page — live key/value editor

Previously the Settings page rendered a static YAML blob with an
"Edit (host config)" placeholder. Now it:

- Fetches live `/edge-api/v1/network/settings` on mount
- Renders every key/value in a table
- Each row has a row-menu **Edit** that opens an inline input
- Enter or Save button commits via `PUT /network/settings/{key}`
- Download / Copy regenerate `network.yaml` from the live map
  (not from a hardcoded template)

## 4. Server-side additions

### Repository

`NetworkRepository` gains five full-record edit methods:

```java
int editRule(id, position, src, dst, action, note, actor)   // full-field policy update
int updateApConfig(ssid, band, channel, security, iface, gateway, subnet)
int updateClientLabel(deviceId, owner, hostname)
int updateInterfaceConfig(name, priority, purpose)
int updatePeerConfig(id, nodeId, siteId, endpoint, publicKey, allowedIps)
```

Every method uses `COALESCE(?, column)` so a null field preserves
the current value — operators can tweak one field at a time without
clobbering everything else.

### Service

`NetworkService` gains the matching `edit*` wrappers; each records
a dedicated audit event (`AP_CONFIG_UPDATED`, `DEVICE_LABEL_UPDATED`,
`IFACE_CONFIG_UPDATED`, `PEER_UPDATED`, `FIREWALL_RULE_UPDATED`).

### Controller

Five new endpoints, all ADMIN-gated:

```
PUT /edge-api/v1/network/access-point      body: ApBody
PUT /edge-api/v1/network/clients/{id}      body: ClientBody
PUT /edge-api/v1/network/interfaces/{name} body: InterfaceBody
PUT /edge-api/v1/network/peers/{id}        body: PeerBody
PUT /edge-api/v1/network/policy/{id}       body: PolicyBody   (expanded)
```

`PolicyBody` already carried every field (position, sourceZone,
destinationZone, action, note) — only the controller's `editRule`
handler needed to pass them all through.

## 5. Security page cleanup

Carrying over from 2.1.90, the Security page's cleanup is now
complete: no static Phase-N panels, no "Click an action chip"
tooltip. The flow is:

```
Add rule           → PolicyDialog (add)
Click action chip  → cycles allow → controlled → deny (one PUT)
Row-menu Edit      → PolicyDialog (edit)   [NEW]
Row-menu Delete    → DELETE /policy/{id}
Download policy    → JSON of live rules
Refresh            → GET /policy
View audit         → /audit/events?category=network  [FIXED]
```

Everything is backed by live DB state; every action records an
audit event.

## 6. Live assertions

```
== Audit page with peer filter ==
  h1: Network audit · 0 events
  subtitle contains peer=: true

== Audit page with category=network ==
  h1: Network audit · 41 events

== Audit page default (no filter) ==
  h1: Alerts & activity · 100 events

== Edit AP ==
  Edit AP button present:            true
  Dialog opens:                       true
  SSID input prefilled with DER-EDGE: true

== Edit firewall rule ==
  Row-menu "Edit rule" visible:      true
  Dialog title: Edit firewall rule   ✓

== Edit interface ==
  Row-menu "Edit (priority / purpose)" opens
  Dialog title: Edit interface — eth0 ✓

== Settings in-place edit ==
  Settings rows: 13
  Inline input visible after Edit:   true

Total pageerrors: 0
```

Screenshot `/tmp/der-2.1.91-audit-peer.png` shows the audit page
loading the peer-filtered view — pill text visible, Clear filter +
Diagnostics action buttons on the right.

## 7. Files changed

```
server/src/main/java/ug/ac/mak/der/network/NetworkRepository.java   — editRule + 4 update*Config methods
server/src/main/java/ug/ac/mak/der/network/NetworkService.java      — editRuleFull + 4 edit wrappers with audit
server/src/main/java/ug/ac/mak/der/web/NetworkController.java       — PUT access-point/clients/interfaces/peers; policy PUT expanded; 4 Body records
admin-ui/src/screens/MoreScreens.tsx                               — MockupAuditEvents dual-mode with network filters
admin-ui/src/screens/Network.tsx                                   — 5 Edit dialogs (ApEditDialog, ClientLabelDialog, InterfaceConfigDialog, PeerDialog add+edit, PolicyDialog add+edit) + Settings live editor; broken /security/audit links swapped to /audit/events
admin-ui/src/api/edgeApi.ts                                        — 5 new PUT helpers + NetworkInterface.priority / NetworkPeer.publicKey+allowedIps / AccessPointStatus.subnet typings widened
```

## Build + test

```
tsc -b && vite build                   ✓ 1759 modules → 629.08 KB
./mvnw -q -DskipTests package          ✓ 2.1.91 JAR built
Live Playwright full-flow sweep        ✓ 0 pageerrors, every Edit dialog opens + saves
```
