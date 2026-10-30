# der-2.2.10 (stable)

**Date:** 2026-10-30
**Previous stable:** `der-2.2.9`

## Headline

Three mesh-topology fixes bundled into one release:

1. **DER↔device link** always solid (`wifi`), regardless of form
   factor. Previously MOBILE devices got `type: p2p` which rendered
   dashed on an otherwise solid LAN link.
2. **WAN↔DER line** moved to top-right, drawn with a distinct
   accent-blue colour + 2.5 px stroke so it reads as the backbone;
   guaranteed to not overlap any device slot.
3. **Devices page** surfaces `displayName` + `formFactor` columns so
   the fleet list matches what the topology shows (same devices, same
   names — one source of truth).

## 1. DER↔device solid

`NetworkTopologyService.topology()` previously set
`type = formFactor == MOBILE ? "p2p" : "wifi"`. The reference image
shows every DER→device line solid (dashed only for genuine
device↔device P2P adjacencies). Fix: always set `type: "wifi"` for
DER↔device. Form factor still drives the device icon + sync label,
not the connection class.

Dashed promotion for offline / degraded endpoints still fires per
spec §14 — a Wi-Fi link to an offline device is correctly rendered as
a red dashed line.

## 2. WAN visual + routing

### `topologyLayout.ts`

```ts
// Was: top-centre, straight above DER — crossed the top-centre device
export function wanPosition(): Point {
  return { x: CENTRE.x + 300, y: CENTRE.y - 320 };  // top-right
}
```

Line from DER (500, 390) to WAN (800, 70) now passes well clear of
every device slot.

### `NetworkConnection.tsx`

```ts
const stroke =
    status === 'offline'  ? statusFill('offline')
  : status === 'degraded' ? statusFill('degraded')
  : isWan                 ? 'var(--der-primary-ink, #2563eb)'  // blue
  : 'var(--der-ink-300, #cbd5e1)';                              // grey

const strokeWidth = isWan ? 2.5 : 1.5;
```

WAN is solid blue 2.5 px when online, promotes to amber / red dashed
when degraded / offline. The thicker stroke + distinct hue make the
WAN state readable at a glance without colour alone.

## 3. Device-fleet consistency

`MockupDeviceFleet` previously showed only the UUID prefix in the
Device column so the demo fleet looked anonymous even though the
backend had friendly names. Fix:

- Column 1: `displayName` (fallback *unnamed*) + UUID prefix in a
  muted sub-row
- New column: Form factor (Workstation / Laptop / Tablet / Mobile)
- Search box now matches on displayName + formFactor + UUID + UA

Both `/admin/devices` and `/admin/network/mesh` now show the exact
same six devices with the exact same names, from the exact same
`der.edge_device` table.

## 4. Verified live

```
Mesh topology — DER↔device link types:
  6 DER↔device links, all type=wifi            ✓
  0 non-wifi DER↔device links                   ✓

WAN line:
  stroke  = var(--der-primary-ink, #2563eb)     ✓ blue
  width   = 2.5 px                              ✓ distinct weight
  dashed  = false                               ✓ solid when online
  endpoints (500,390) → (800,70)                ✓ top-right routing
  crosses 0 device bounding boxes               ✓

Devices page:
  6 rows rendered with displayName + formFactor
    "Community Device"   Mobile       APPROVED
    "Pharmacy"           Tablet       APPROVED
    "Consultation"       Laptop       APPROVED
    "Laboratory"         Workstation  APPROVED
    "Triage Tablet"      Tablet       APPROVED
    "Registration"       Workstation  APPROVED
  rows with proper displayName: 6               ✓

Topology edges after heartbeat:
  13 total — 7 solid (6 DER↔device Wi-Fi + 1 WAN) + 6 dashed
  (2 DER↔peer + 4 device↔device P2P)

pageerrors: 0
```

## 5. Files changed

```
server/src/main/java/ug/ac/mak/der/network/NetworkTopologyService.java   — type: 'wifi' for all DER↔device
admin-ui/src/components/network/topologyLayout.ts                        — wanPosition top-right
admin-ui/src/components/network/NetworkConnection.tsx                    — isWan accent blue + 2.5 px
admin-ui/src/screens/MoreScreens.tsx                                     — Devices table shows name + form factor
VERSION / server/pom.xml / admin-ui/package.json                         — bumped
admin-ui/public/sw.js                                                     — SW_VERSION → 2.2.10
```

## Build + test

```
tsc -b && vite build                        ✓ 90 modules
./mvnw -q -DskipTests clean package         ✓ 2.2.10 JAR
Playwright sweep                            ✓ 7 solid + 6 dashed, 0 WAN crossings, 0 pageerrors
```
