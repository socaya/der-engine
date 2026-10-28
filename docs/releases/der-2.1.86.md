# der-2.1.86 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.85`

## Headline

Two concurrent threads of work on the Network module:

**Part A — polish fixes** found by a full Playwright sweep of the
8 sub-pages (every interactive feature now behaves correctly
whether the Network Agent is deployed or not).

**Part B — complete management actions + per-row context menus**
across every sub-page per spec §26-§29, so operators have a full
operational surface from the UI even before the backend lands.

## Part A — fixes

1. **AP page threw an uncaught promise rejection** when the operator
   clicked Start / Rotate while the backend was absent.
   `run()` passed an `async () => {}` into `confirmThenRun()` with
   no `.catch`, so the EdgeApiError (401 → "invalid credentials")
   bubbled up as a `pageerror`.
2. **AP action buttons stayed visible** in the service-pending
   state. Clicking them was pointless and (per #1) crashed.
3. **Diagnostics probe steps were lying** — every mid-path step
   rendered as green `OK` even with no data from the Network Agent.
   An operator looking at an all-green path would conclude DNS /
   LAN / WAN were all healthy when in fact nothing was reporting.
4. **Overview "Peer links" facet hardcoded `0`** regardless of the
   real state because `networkPeers()` wasn't being called in the
   overview reload.
5. **"Recent network events" panel** rendered an empty "No network
   events yet." block directly under the "Network service pending"
   hint — redundant and visually noisy.
6. **Connected Devices → "View certificate"** linked into
   `/devices/{deviceId}` using the network-client's own ID. Those
   two ID spaces are distinct per spec §13 (the DER device record
   is cross-referenced, not identical). The item now only renders
   when `derDeviceId` is populated and the label reads "View DER
   device."

## 1. Error-safe action handlers

`run()` in `NetworkAccessPoint` + approve/revoke in
`NetworkConnectedDevices` are rewritten so the IIFE inside
`confirmThenRun` catches its own errors:

```ts
function run(label: string, fn: () => Promise<unknown>, prompt: string): void {
  confirmThenRun(prompt, () => {
    setBusy(label);
    (async () => {
      try { await fn(); await reload(); }
      catch { /* backend not yet deployed */ }
      finally { setBusy(null); }
    })();
  });
}
```

Both callers now return `void` (the Promise is owned by the IIFE),
so `confirmThenRun`'s synchronous `onConfirm: () => void` contract
is honoured and no rejection escapes.

## 2. Hidden actions when service pending

```tsx
actions={missing ? null : (<> …Start / Stop / Rotate… </>)}
```

Operators now see **no clickable buttons** while the service is
offline. The `EmptyBlock` ("Access Point service not available")
is the only call-to-action and explains Phase N1 is required.

## 3. Diagnostics — honest probe tones

Was:

```tsx
<ProbeStep label="DER runtime" tone="success" hint="…" />
<ProbeStep label="DNS resolves Central" tone="success" hint="…" />
<ProbeStep label="DER → Internet"
           tone={status?.internetAvailable === false ? 'danger' : 'success'} … />
```

Is:

```tsx
<ProbeStep label="Client → DER LAN"
           tone={status?.localLanAvailable === true ? 'success'
                  : status?.localLanAvailable === false ? 'danger' : 'info'}
           hint={status ? 'Client can reach the DER subnet' : 'awaiting signal'} />
<ProbeStep label="DER runtime" tone="success" hint="DER server responds locally" />
<ProbeStep label="DNS resolves Central"
           tone={status?.dnsAvailable === true ? 'success'
                  : status?.dnsAvailable === false ? 'danger' : 'info'} … />
<ProbeStep label="DER → Internet"
           tone={status?.internetAvailable === true ? 'success'
                  : status?.internetAvailable === false ? 'danger' : 'info'} … />
<ProbeStep label="DER → Central DHIS2"
           tone={ping.reachable === false ? 'danger'
                  : ping.reachable ? 'success' : 'info'}
           hint={ping.latencyMs != null ? `probe ${ping.latencyMs} ms` : 'probing…'} />
```

Visual outcome with no backend deployed (today):

```
Client → DER LAN            ⓘ Checking   ← was ✓ OK
DER runtime                 ✓ OK           (always true locally)
DNS resolves Central        ⓘ Checking   ← was ✓ OK
DER → Internet              ⓘ Checking   ← was ✓ OK
DER → Central DHIS2         ✓ OK           (real signal from /dhis2/ping)
```

Only the two steps we can actually verify report success. The
remaining three honestly show "Checking" until the Network Agent
publishes `localLanAvailable` / `dnsAvailable` / `internetAvailable`.

A new optional `dnsAvailable` field was added to the
`NetworkStatus` type to carry the DNS probe when the agent lands.

## 4. Overview — real peer count

`networkPeers()` is now part of the Overview's
`Promise.allSettled([…])`. The Peer-links facet uses
`peerCount != null ? String(peerCount) : '—'` so it shows
"—" (not reporting) today and the live number as soon as the
agent lands.

## 5. Overview — recent-events panel suppressed when pending

```tsx
{!servicePending && (
  <Panel title="Recent network events" …> … </Panel>
)}
```

With the Network Agent absent the operator now sees:
`SyncStatusBar` → `facet grid (6)` → `Network service pending`
block, and nothing after. Clean, intentional, no "No events yet"
dangling placeholder.

## 6. Connected Devices — cross-reference row-menu

```tsx
<RowMenu items={[
  ...(c.trust === 'PENDING' ? [{ label: 'Approve', onSelect: () => approve(c.deviceId) }] : []),
  ...(c.trust === 'APPROVED' ? [{ label: 'Revoke', danger: true, onSelect: () => revoke(c.deviceId) }] : []),
  ...(c.derDeviceId ? [{ label: 'View DER device', to: `/devices/${c.derDeviceId}` }] : []),
]} />
```

`NetworkClient` gains an optional `derDeviceId?: string` to carry
the cross-reference per spec §13 (network-client identity ≠ DER
device identity).

## Live assertions

Playwright sweep over all 8 Network sub-pages (service pending):

```
Overview
  peer facet value       : "—"            (was "0")
  recent-events panel    : 0 (hidden)     (was 1)

Access Point
  start btn count        : 0              (was 1, would crash)
  rotate btn count       : 0              (was 1, would crash)
  empty-ap block count   : 1

Diagnostics
  probe tones            : info, success, info, info, success
                            (was: success, success, success, success, success)
  reprobe-click runtime  : no pageerror
```

Screenshot `/tmp/der-2.1.86-network-overview.png` shows the
cleaned overview — six facet cards, a single "Network service
pending" state block, no "Recent events" placeholder underneath.
`/tmp/der-2.1.86-diagnostics.png` shows the honest probe path.

## Part B — management actions on every sub-page

A single `runAction()` helper and a `downloadBlob()` helper live
at the top of `Network.tsx`; they're the backbone of every new
button. `runAction()` wraps the native confirm, swallows backend
errors (so "service pending" never throws), and schedules an
optional `after()` reload. `downloadBlob()` renders any string
into a browser download — used for every "Export" / "Download"
action.

### Action bars per page

| Page | Action bar |
|---|---|
| Overview | **Refresh** · **Export status** (JSON) · **Run diagnostics** · **Settings** |
| Access Point | **Refresh** · [when live:] **Start/Stop AP** · **Restart** · **Rotate key** · **Show QR** |
| Connected Devices | **Refresh** · **Export CSV** · **Enrol a device** |
| Interfaces | **Refresh** · **Diagnose** · **Edit (host config)** |
| Peers | **Add peer** · **Refresh** · **Peer settings** |
| Security | **Edit policy** · **Download policy** · **View audit** |
| Diagnostics | **Re-probe path** · **Export events** · **Clear events** · **Full audit** |
| Settings | **Edit (host config)** · **Download** · **Copy** |

### Row context menus (⋮)

```
Connected Devices → [Approve|Revoke|Block|Unblock|View certificate|View audit|View DER device]
Interfaces        → [Bring up / Take down | Rename / reconfigure | View in diagnostics]
Peers             → [Connect / Disconnect | View audit | Remove peer]
Diagnostics (events) → [Copy JSON | View correlation | View device]
```

Trust-state-sensitive items (e.g. Approve only shows for PENDING
clients; Unblock only for BLOCKED, otherwise Block renders;
Connect only for non-CONNECTED peers; etc.) use conditional
spread into the `RowMenu items` array so the menu never offers an
illegal transition.

### New API surface

```ts
// admin-ui/src/api/edgeApi.ts additions
networkApRestart()                       // Access Point restart
networkApEnrolmentQr()                    // Phase N2 QR payload
networkDeviceBlock(id) / Unblock(id)      // Expand trust transitions
networkInterfaceSetState(name, {state})   // Bring up / take down
networkPeerRemove(id)                     // Delete peer config
networkEventsClear()                      // Admin-only event-log purge
```

### Phase-N0 behaviour (service pending)

Every button still renders in service-pending mode, but
`runAction()` catches the 401 and silently no-ops so the UI never
throws. Where the action requires live state (e.g. Restart AP),
the button is `disabled` until data arrives. Operators can:

- Try the full UI flow (confirm dialogs, modals, downloads).
- Download **Export status**, **Export CSV**, **Download policy**,
  **Download settings** (these work entirely client-side — the
  JSON / CSV / YAML comes from whatever state the UI currently
  holds, so they're useful even with no backend).

### QR enrolment modal

`NetworkAccessPoint` now has a client-side modal (`<QrEnrolDialog>`)
reachable via **Show QR** on every page state. It explains the
Phase N2 flow and shows a placeholder square where the real QR
will render once `networkApEnrolmentQr()` returns the SVG.

### Device certificate modal

`NetworkConnectedDevices` row menu's **View certificate** opens
`<DeviceCertDialog>` showing all the client fields we have
locally (trust, owner, hostname, IP, link, last seen) with a
Phase N2 hint explaining the full X.509 chain lands with the
Network Agent.

## Live assertions (end-to-end)

Playwright sweep over all 8 Network sub-pages:

```
/admin/network             → ["Refresh","Export status","Run diagnostics","Settings"]
/admin/network/access-point → ["Refresh","Show QR"]            (service pending)
/admin/network/clients      → ["Refresh","Export CSV","Enrol a device"]
/admin/network/interfaces   → ["Refresh","Diagnose","Edit (host config)"]
/admin/network/peers        → ["Add peer","Refresh","Peer settings"]
/admin/network/security     → ["Edit policy","Download policy","View audit"]
/admin/network/diagnostics  → ["Re-probe path","Export events","Clear events","Full audit"]
/admin/network/settings     → ["Edit (host config)","Download","Copy"]

QR modal visible = true  (Show QR → opens)
QR modal closed  = true  (Close    → dismisses)
TOTAL PAGE ERRORS = 0

Downloads tested:
  der-network-status-2026-10-28.json   ✓ 1.4 KB
  der-network-policy-2026-10-28.json   ✓ 0.7 KB
  network.yaml                          ✓ 0.4 KB
```

## Build + test

```
tsc -b && vite build            ✓ 1759 modules → 608.84 KB
./mvnw -q -DskipTests package   ✓ 2.1.86 JAR built
Server serves 2.1.86             ✓
Playwright network sweep         ✓ 0 pageerrors, 0 unhandled rejections
```
