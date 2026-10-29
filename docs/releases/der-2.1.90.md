# der-2.1.90 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.89`

## Headline

Three remaining-phase gaps closed + two chrome-cleanup requests:

1. **Phase N4 — automatic WAN failover.** The probe loop now
   reconciles the default route every 30 s against the live
   interface state. If the primary interface goes down, the next
   highest-priority UP interface tagged for WAN use is promoted;
   `ROUTE_FAILOVER` / `ROUTE_WAN_LOST` / `ROUTE_WAN_RESTORED`
   events land in the audit on every transition.
2. **Phase N2 — enrolment-token lifecycle.** Operators can now
   issue one-shot 30-minute tokens from the Enrol modal; devices
   consume them on first `/network/enroll` call. Token hashes
   persist to `der.network_enrol_token`; audit records
   `ENROL_TOKEN_ISSUED`.
3. **Phase N1 — DHCP leases + Routes visibility.** New read endpoints
   `/network/leases` + the existing `/network/routes` are now
   rendered under the Interfaces page in dedicated panels.
4. **AP cleanup.** The "QR enrolment · Phase N2" static panel on
   `/network/access-point` is removed — the whole enrol flow lives
   in the modal reachable from Clients.
5. **Security page cleanup.** The static "Layered security model"
   panel and the "Click an action chip to cycle …" tooltip are
   removed; the behaviour is self-evident and the layered model is
   already enforced across the module (see §5).

## 1. Phase N4 — WAN failover

`NetworkService.reconcileWanRoute()` runs at the end of every
probe cycle (every 30 s). Logic:

```java
pick = network_interface
         WHERE state = 'up'
           AND administrative_up = TRUE
           AND purpose IN ('facility-lan','upstream-wifi','cellular-fallback')
         ORDER BY priority ASC LIMIT 1

if pick == null:
  if a default route is currently active:
    deactivate it + record ROUTE_WAN_LOST (fires ONCE)
elif pick == current primary:
  no-op
else:
  promote pick's interface + record
    ROUTE_WAN_RESTORED  (first time there was no primary)
    ROUTE_FAILOVER      (hand-off from a previous primary)
```

Live transition sequence from a running edge:

```
Cycle 1  (eth0 up)   → default=eth0  · event: ROUTE_WAN_RESTORED
Cycle 2  (eth0 down) → default=NONE  · event: ROUTE_WAN_LOST
Cycle 3  (eth0 up)   → default=eth0  · event: ROUTE_WAN_RESTORED
```

Each transition fires exactly one audit event — the "deactivate
stale route" step keeps the loop idempotent so WAN_LOST doesn't
spam the audit on every cycle.

The actual OS-level route change (`ip route add default via …
dev …`) happens behind `NetworkAgent.setInterfaceState`; the
Linux agent carries out `ip link set up` which triggers
NetworkManager's own DHCP acquisition — no custom `ip route`
plumbing needed on Ubuntu.

## 2. Phase N2 — enrolment tokens

### Issuance

```
POST /edge-api/v1/network/enrol-tokens  (ADMIN)
Body: { "ttlSeconds": 1800, "deviceIdHint": "TAB-DEMO-01" }
→ 201 {
    "token": "Mm7wCyTNTafJjZjC88qbL2en…",   ← one-shot plaintext
    "ttlSeconds": 1800,
    "deviceIdHint": "TAB-DEMO-01"
  }
```

Only the hash lands in Postgres (`der.network_enrol_token`).
`ENROL_TOKEN_ISSUED` audit records the operator + the hint. Issuer
is responsible for handing the token to the device out-of-band.

### Consumption

Devices present the token on their first `/network/enroll` call.
`NetworkService.consumeEnrolToken(token, deviceId)` atomically
marks the row consumed; a token can be used at most once.

### UI — Enrol modal

The QR enrol modal (opened from Clients → **Enrol a device**) now
has an "Optional — one-shot enrol token (30 min)" strip below the
QR. Click **Issue token** → modal shows the plaintext token with a
**Copy** button. Hand to the device, close dialog.

### List

```
GET /edge-api/v1/network/enrol-tokens
→ { tokens: [{ issuedAt, expiresAt, deviceIdHint,
               consumedAt, consumedBy }, …] }
```

(No plaintext tokens exposed — rows only carry the metadata.)

## 3. Phase N1 — DHCP leases + Routes visibility

### New endpoint

```
GET /edge-api/v1/network/leases
→ { leases: [{ mac, ip, hostname, issuedAt, expiresAt,
               staticLease }, …] }
```

Only `expires_at > now()` rows returned.

### UI — Interfaces page now carries three panels

```
┌─────────────────────────────────────────────────────────────┐
│  Interfaces · n up / n total                                │
│  [name] [kind] [purpose] [state] [address] [MAC] [link] [⋮] │
├─────────────────────────────────────────────────────────────┤
│  Routes · n                                                 │
│  [dest] [gateway] [interface] [metric] [source] [active]    │
├─────────────────────────────────────────────────────────────┤
│  DHCP leases · n                                            │
│  [MAC] [IP] [hostname] [issued] [expires] [kind]            │
└─────────────────────────────────────────────────────────────┘
```

(Routes column was already in the backend from 2.1.87; now it has
a UI home. Leases uses the Phase N1 ingest endpoint shipped in
2.1.88.)

## 4. AP page cleanup

Removed the "QR enrolment · Phase N2" static panel beneath the AP
status card. The entire enrol flow is reachable via **Show QR** on
the AP page or **Enrol a device** on the Clients page. The AP page
now shows just AP state + action buttons.

## 5. Security page cleanup

Two UI removals, zero behaviour change:

- The **Layered security model (§10)** `<ol>` + "Can join DER
  network ≠ can access DER application / data" explainer paragraph.
- The "Click an action chip to cycle allow / controlled / deny."
  tooltip above the firewall rules table.

The layered-security model is already enforced across the Network
module:

| §10 Layer | Where it's enforced |
|---|---|
| Wi-Fi / Ethernet connectivity | `NetworkAgent` / `LinuxNetworkAgent` |
| Network admission            | `network_client.trust` state machine (PENDING→APPROVED→REVOKED/BLOCKED) |
| Device identity              | `NetworkCaService` Ed25519 attestations |
| TLS / encrypted tunnel       | Spring Boot HTTPS |
| DER user authentication      | `EdgeUserPrincipal` + session cookie |
| DHIS2-derived authorization  | `SecurityConfig` role matchers |
| Workflow / record access     | ADR-0007 program-rule engine (out of module) |
| Audit                        | `network_event` + journal |

Each sub-page writes its state transitions through this stack — the
diagram is implementation, not a to-do.

## 6. Live assertions

```
WAN failover audit cycle:
  Cycle 1 (eth0 up)    default=eth0   events: ROUTE_WAN_RESTORED
  Cycle 2 (eth0 down)  default=NONE   events: ROUTE_WAN_LOST
  Cycle 3 (eth0 up)    default=eth0   events: ROUTE_WAN_RESTORED

Enrol token:
  POST /enrol-tokens  → 201  token=Mm7wCyTNTafJjZjC88qbL2en…
  GET  /enrol-tokens  → count=1

Leases:
  GET /leases         → count=0  (no DHCP server in dev)

UI assertions:
  /network/security
    "Layered security model" present: false   ✓
    "Click an action chip"   present: false   ✓
    "Can join DER network"   present: false   ✓
    Rule rows:                       8        ✓
  /network/access-point
    "QR enrolment" panel present:  false       ✓
  /network/interfaces
    "Routes · n"      present: true           ✓
    "DHCP leases · n" present: true           ✓
  /network/clients (Enrol modal)
    "one-shot enrol token" copy present: true  ✓
    Issue token → opaque token rendered     ✓

Total pageerrors: 0
```

Screenshots:
- `/tmp/der-2.1.90-security.png` — Security page without the static panel
- `/tmp/der-2.1.90-enrol-token.png` — Enrol modal with the token issuer

## 7. Files changed

```
server/src/main/java/ug/ac/mak/der/network/NetworkRepository.java   — listLeases, pickWanCandidate, promoteDefaultRoute, deactivateDefaultRoute, insert/consume/list EnrolToken
server/src/main/java/ug/ac/mak/der/network/NetworkService.java      — reconcileWanRoute wired into probe loop, enrol-token issue/consume/list
server/src/main/java/ug/ac/mak/der/web/NetworkController.java       — /leases, /enrol-tokens GET+POST
admin-ui/src/screens/Network.tsx                                   — Enrol modal token issuer; Routes + DHCP leases panels on Interfaces; AP QR panel removed; Security static panels removed
admin-ui/src/api/edgeApi.ts                                        — networkLeases, networkEnrolTokens, networkEnrolTokenIssue, NetworkRoute shape corrected
```

## Build + test

```
tsc -b && vite build          ✓ 1759 modules → 619.47 KB
./mvnw -q -DskipTests package ✓ 2.1.90 JAR built
Scheduled probe + failover    ✓ exactly one audit per transition
Playwright sweep              ✓ 0 pageerrors
```
