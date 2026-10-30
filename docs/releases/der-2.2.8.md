# der-2.2.8 (stable)

**Date:** 2026-10-30
**Previous stable:** `der-2.2.7`

## Headline

**Mesh topology layout fix** — nodes no longer overlap when the facility
has 6 devices + peer edges. The hex-6 layout from the reference image is
now pinned explicitly instead of being approximated by evenly-spaced
ring positions.

## 1. Problem

The 2.2.7 topology used `ringLayout` to spread N devices evenly around
the DER centre. For N=6 the angular positions worked, but device cards
at the east and west positions (θ=0 and θ=π) overlapped the DER card
horizontally because the ring radius (220 px) wasn't large enough to
clear the DER card half-width (110 px) plus the device card half-width
(85 px). Peer edges on a second ring at radius 290 overlapped the
device cards at the same compass positions.

## 2. Fix

`admin-ui/src/components/network/topologyLayout.ts`:

- Canvas grown from 900×620 to **1000×760** so there's room for the full
  hex pattern + peers.
- CENTRE raised to y=390 so the WAN cloud + top-device slot both fit
  above the DER card with 30+ px clearance.
- Introduced `DEVICE_SLOTS` — six fixed `(x, y)` positions matching the
  reference image:

  ```
  slot 0 top-centre      (CENTRE.x,       CENTRE.y - 230)
  slot 1 upper-right     (CENTRE.x + 290, CENTRE.y - 125)
  slot 2 lower-right     (CENTRE.x + 290, CENTRE.y + 125)
  slot 3 bottom-centre   (CENTRE.x,       CENTRE.y + 230)
  slot 4 lower-left      (CENTRE.x - 290, CENTRE.y + 125)
  slot 5 upper-left      (CENTRE.x - 290, CENTRE.y - 125)
  ```

- Introduced `PEER_SLOTS` — six positions chosen to fall **between**
  device slots so cards never collide:

  ```
  east   (CENTRE.x + 400, CENTRE.y      )
  west   (CENTRE.x - 400, CENTRE.y      )
  ne     (CENTRE.x + 340, CENTRE.y - 240)
  sw     (CENTRE.x - 340, CENTRE.y + 240)
  se     (CENTRE.x + 340, CENTRE.y + 240)
  nw     (CENTRE.x - 340, CENTRE.y - 240)
  ```

- `layoutDevices()` and `layoutPeers()` use the slots for the first 6
  nodes and fall back to ring layout only when the facility has more
  than 6 of each kind.

## 3. Verified live

Seeded 5 extra devices to fill all six slots (Registration, Triage
Tablet, Laboratory, Pharmacy, Consultation, Community Device) alongside
the existing 2 peer edges. Playwright measured every rendered node's
bounding box:

```
10 nodes rendered: WAN + DER + 6 devices + 2 peers
Pairwise AABB intersection:   0 overlaps
Canvas-escape check:          0 escapes
pageerrors:                   0
```

Node positions:

```
WAN connection               (643, 318) 161×54
DER Edge Runtime             (625, 608) 196×80
Community Device (slot 0)    (648, 409) 152×68
Pharmacy        (slot 1)     (906, 502) 152×68
Consultation    (slot 2)     (906, 726) 152×68
Laboratory      (slot 3)     (648, 819) 152×68
Triage Tablet   (slot 4)     (389, 726) 152×68
Registration    (slot 5)     (389, 502) 152×68
Peer east                    (1005, 614) 152×68
Peer west                    ( 290, 614) 152×68
```

Slots are populated in the order the server returns devices
(`enrolled_at DESC`). Operators who want a specific slot assignment
can enrol / rename devices in that order.

## 4. Files changed

```
admin-ui/src/components/network/topologyLayout.ts    — DEVICE_SLOTS + PEER_SLOTS + layout helpers
admin-ui/src/components/network/TopologyCanvas.tsx   — use layoutDevices/layoutPeers + maxHeight 760
VERSION / server/pom.xml / admin-ui/package.json     — bumped
admin-ui/public/sw.js                                — SW_VERSION → 2.2.8
```

## Build + test

```
tsc -b && vite build                      ✓ 90 modules
./mvnw -q -DskipTests clean package       ✓ 2.2.8 JAR (no server changes)
Playwright overlap sweep                  ✓ 10 nodes, 0 overlaps, 0 escapes, 0 pageerrors
```
