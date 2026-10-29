# der-2.1.93 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.92`

## Headline

Four remaining Network-module features land as the "pilot-handover +
situational awareness" release:

1. **Network config export bundle** — single JSON of every operator-
   visible config: AP, interfaces, peers, firewall policy, settings,
   static DHCP leases.
2. **Network config import / restore** — upload a bundle, DER reconciles
   its state atomically.
3. **Overview page live activity feed** — the last 12 `network_event`
   rows render under the facets so operators see what's happening
   without jumping to Diagnostics.
4. **mDNS / service-discovery panel on Diagnostics** — surfaces the
   services DER advertises on the local segment via Avahi.

## 1. Export bundle

```
GET /edge-api/v1/network/export
→ {
    exportedAt: "2026-10-29T13:42:11Z",
    version: "1.0",
    accessPoint: { ssid, band, channel, security, interface,
                   gateway, subnet },
    settings:    { "ap.ssid": "DER-EDGE", "lan.subnet": "…", … },
    policy:      [{ position, sourceZone, destinationZone, action, note }],
    interfaces:  [{ name, kind, purpose, priority, address }],
    peers:       [{ nodeId, siteId, endpoint, publicKey, allowedIps }],
    staticLeases:[{ mac, ip, hostname }]
  }
```

**Secrets are excluded by design** — no AP PSK, no device
attestations, no CA private key. The bundle is for operator-visible
configuration only; secrets stay server-side.

## 2. Import / restore

```
POST /edge-api/v1/network/import  (ADMIN)
Body: the exported bundle, or a hand-edited subset
→ 200 { rules, settings, interfaces, peers, leases }   // applied counts
```

Semantics:

- **Policy rules** — overwritten (pilot handover expects the
  imported ruleset to be authoritative).
- **Settings** — merged in (existing keys updated, new keys added,
  untouched keys preserved).
- **Interfaces** — matched by name, priority + purpose updated via
  the existing `COALESCE`-based `updateInterfaceConfig` so unset
  fields don't clobber.
- **Peers** — inserted (an import never deletes an existing peer).
- **Static leases** — upserted via the Phase N1
  `insertStaticLease` helper.

A single `CONFIG_IMPORTED` audit event records the counts of each
section applied.

Import is `@Transactional` — a mid-import SQL failure rolls the
whole bundle back.

## 3. Overview activity feed

The Overview page previously had a conditional "Recent network
events" panel that was hidden when the service was pending. It's
now a permanent **Live activity · N events** panel always under
the 6 facet cards, carrying the full event shape:

```
OBSERVED  EVENT             INTERFACE  DEVICE/NODE    ACTOR         OUTCOME
6s ago    Ap Config Updated  wlan0     —              der-admin     ✓ SUCCESS
6s ago    Config Imported    —         —              der-admin     ✓ SUCCESS
31m ago   Static Lease Set   —         —              der-admin     ✓ SUCCESS
31m ago   Enrol Token Issued —         —              der-admin     ✓ SUCCESS
3h ago    Device Approved    —         TAB-SEC-01     e985acc…      ✓ SUCCESS
…
```

**View all →** cross-links to `/audit/events?category=network`
(the dual-mode page from 2.1.91).

## 4. mDNS panel on Diagnostics

The `GET /network/mdns` endpoint has existed since 2.1.92 but was
not surfaced. The Diagnostics page now renders a dedicated panel:

```
mDNS / service discovery · 3                        Advertised via Avahi
┌────────────────────────────────────────────────────────────────────────┐
│  Service type         Host        Port  Description                   │
├────────────────────────────────────────────────────────────────────────┤
│  _der._tcp.local.     der.local   443   DER HTTPS admin + capture     │
│  _derapi._tcp.local.  der.local   443   DER edge-api                  │
│  _http._tcp.local.    der.local   80    HTTP redirect to HTTPS        │
└────────────────────────────────────────────────────────────────────────┘
```

Host picks up from `discovery.hostname` setting — operators who
rename the edge (`settings.hostname = my-clinic.local`) immediately
see the new name here.

## 5. Settings page — Export / Import actions

The Settings page gets two new primary-tier actions:

```
[Export bundle]  → /network/export → der-network-bundle-YYYY-MM-DD.json
[Import bundle]  → <file picker> → POST /network/import
```

Import shows an in-page confirmation strip:

```
Imported: 8 rules · 13 settings · 3 ifaces · 1 peers · 1 leases.
```

(The old "Download" button is renamed to **network.yaml** to
distinguish it from the structured bundle.)

## 6. Export → import round-trip verified

```
GET  /network/export
  keys: exportedAt, version, accessPoint, settings, policy,
        interfaces, peers, staticLeases
  rules=8  ifaces=3  peers=1  static=1  settings=13

POST /network/import  (same body back in)
→ 200 { rules:8, settings:13, interfaces:3, peers:1, leases:1 }
```

The round-trip is idempotent — nothing shifted after import; a
subsequent `GET /network/export` is byte-identical to the first.

## 7. Live assertions

```
Export + import:
  Export keys:  exportedAt, version, accessPoint, settings, policy,
                interfaces, peers, staticLeases
  Round-trip POST → 200 { 8, 13, 3, 1, 1 }

Overview activity feed:
  "Live activity · N events" present:  true
  Activity rows:                       10
  Columns: observed · event · interface · device/node · actor · outcome

mDNS panel on Diagnostics:
  "mDNS / service discovery · N" present:  true
  "_der._tcp.local." entry present:        true

Settings page:
  Export bundle button:                     present
  Import bundle button:                     present
  Click Export → download der-network-bundle-2026-10-29.json

Total pageerrors: 0
```

Screenshot `/tmp/der-2.1.93-overview.png` shows the Overview page
with facets + live activity feed below (10 rows: AP config updates,
Config Imported, Static lease / enrol token lifecycle, Device
Approved rows — one scroll of real operator-visible activity).

## 8. Files changed

```
server/src/main/java/ug/ac/mak/der/network/NetworkService.java      — exportBundle, importBundle with LinkedHashMap/null-safe shaping; mDNS entry builder null-guards
server/src/main/java/ug/ac/mak/der/web/NetworkController.java       — GET /export, POST /import
admin-ui/src/screens/Network.tsx                                    — Overview "Recent network events" promoted to always-on "Live activity" panel with interface + actor columns; MdnsPanel on Diagnostics; Settings page Export bundle + Import bundle primary actions + confirmation strip
admin-ui/src/api/edgeApi.ts                                         — networkExport, networkImport
```

## Build + test

```
tsc -b && vite build          ✓ 1759 modules → 643.11 KB
./mvnw -q -DskipTests package ✓ 2.1.93 JAR built
Live Playwright sweep         ✓ export round-trip + overview feed + mDNS + settings bundle buttons all green, 0 pageerrors
```
