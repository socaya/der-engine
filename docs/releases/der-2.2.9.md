# der-2.2.9 (stable)

**Date:** 2026-10-30
**Previous stable:** `der-2.2.8`

## Headline

**Device-to-device P2P edges on the mesh topology.** The reference
image's dashed lines between adjacent devices (Registration↔Triage,
Triage↔Laboratory, Community↔Pharmacy, Pharmacy↔Consultation) are now
real data — not decorative. Clients that discover a nearby peer radio
report the adjacency; operators can also declare one manually.

Per spec §20: *"Only render peer connections reported by the
network/discovery layer."*

## 1. Schema (V044)

```sql
der.edge_device_adjacency (
  device_a_id     uuid references edge_device(device_id) on delete cascade,
  device_b_id     uuid references edge_device(device_id) on delete cascade,
  link_type       p2p | bluetooth | wifi-direct | lora | ble-mesh,
  state           active | degraded | offline,
  first_seen_at   timestamptz,
  last_seen_at    timestamptz,
  reported_by     uuid,
  PRIMARY KEY (device_a_id, device_b_id),
  CHECK (device_a_id < device_b_id)
)
```

Pair ordering is canonical (device_a < device_b in lexicographic UUID
byte order) so `(a,b)` and `(b,a)` share one row regardless of which
side reports it.

Indexes on `device_a_id`, `device_b_id`, and `(last_seen_at DESC)`.

## 2. Endpoints

```
GET    /edge-api/v1/devices/adjacencies            — list all pairs
GET    /edge-api/v1/devices/{id}/adjacencies       — pairs involving {id}
POST   /edge-api/v1/devices/{id}/adjacencies       — report / refresh
DELETE /edge-api/v1/devices/{id}/adjacencies/{peerId} — clear
```

`POST` body:

```json
{ "peerDeviceId": "<uuid>", "linkType": "p2p", "state": "active" }
```

Session-auth. `linkType` accepts `p2p | bluetooth | wifi-direct | lora
| ble-mesh` (case-insensitive, dash or underscore). `state` accepts
`active | degraded | offline`.

Idempotent — re-posting the same pair bumps `last_seen_at` and
`reported_by` without creating a duplicate row. Deleting is also
pair-direction agnostic: `DELETE /{a}/adjacencies/{b}` and `.../{b}/.../{a}`
both target the same row.

## 3. Topology integration

`NetworkTopologyService.topology()` now joins
`der.edge_device_adjacency` and appends one `connections[]` entry per
adjacency pair:

```json
{
  "source": "<deviceA uuid>",
  "target": "<deviceB uuid>",
  "type": "p2p",
  "linkType": "bluetooth",
  "status": "online" | "degraded" | "offline",
  "lastSeenAt": "2026-10-30T05:00:00Z"
}
```

The admin UI already renders `type: 'p2p'` connections as dashed grey
lines (red if either endpoint is offline), so no front-end changes were
needed — the data flow lights up the dashed edges automatically.

## 4. Signed-byte UUID gotcha (fixed in-service)

Postgres's `uuid < uuid` operator uses unsigned lexicographic byte
compare. Java's `UUID.compareTo` uses *signed* long compare, so for
UUID pairs where one has high-bit set (e.g. `c777b26f…`) and the other
doesn't (`6dcabdb3…`), the two disagree. The initial seed hit this and
tripped the `(device_a_id < device_b_id)` CHECK constraint.

`DeviceAdjacencyService.upsert()` now canonicalises via
`UUID.toString().compareTo()` which matches Postgres byte order.

## 5. Verified live

Seeded the four reference-image adjacencies against the demo fleet:

```
Registration ↔ Triage Tablet          p2p active
Triage Tablet ↔ Laboratory            p2p active
Community Device ↔ Pharmacy           p2p active
Pharmacy ↔ Consultation               p2p active

Topology /network/mesh/topology:
  connections total:    12
  device↔device p2p:    4

Admin UI canvas:
  edges rendered:       13 (12 dashed + 1 solid DER→Registration)
  device↔device dashed: 4
  nodes:                10 (WAN + DER + 6 devices + 2 peers)
  overlaps:             0
  pageerrors:           0

DELETE round-trip:    204 → 3 edges → re-add → 4 edges  ✓
```

## 6. Files changed

```
database/migrations/V044__device_adjacency.sql                             (new)
server/src/main/java/ug/ac/mak/der/device/DeviceAdjacencyService.java      (new)
server/src/main/java/ug/ac/mak/der/web/DeviceController.java               — adjacency endpoints
server/src/main/java/ug/ac/mak/der/network/NetworkTopologyService.java     — join adjacencies into connections[]
VERSION / server/pom.xml / admin-ui/package.json                            — bumped
admin-ui/public/sw.js                                                       — SW_VERSION → 2.2.9
```

## 7. For device clients

Report a nearby peer whenever discovery detects one (BLE scan, Wi-Fi
Direct probe, LoRa handshake, etc.):

```http
POST /edge-api/v1/devices/<my-id>/adjacencies
Content-Type: application/json

{ "peerDeviceId": "<their-id>", "linkType": "bluetooth", "state": "active" }
```

Re-report on a timer (e.g. every 60 s) so `last_seen_at` stays fresh.
When the link drops, either re-post with `state=offline` or
`DELETE /adjacencies/<their-id>`.

## 8. Known follow-ups

- Automatic `state=offline` after N minutes without re-reporting.
- SSE push on adjacency change (currently topology polls every 15 s).
- Operator CRUD UI for adjacencies (right now via API only).

## Build + test

```
tsc -b && vite build                      ✓ 90 modules
./mvnw -q -DskipTests clean package       ✓ 2.2.9 JAR + V044 applied
Playwright sweep                          ✓ 4 dashed device↔device, 0 overlaps, 0 pageerrors
```
