# der-2.1.92 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.91`

## Headline

Three outstanding Network-spec items close in this release:

1. **Enrolment-token management panel** — operators now see all
   outstanding tokens on the Connected Devices page and can revoke
   any live one (Phase N2 completeness).
2. **TLS certificate panel** — the Security page shows DER's own
   `https://der.local` certificate (subject, issuer, fingerprint,
   SAN, expiry) with a status chip + Download pubkey (spec §11).
3. **Static DHCP lease management** — operators can pin an IP to
   a specific MAC from the Interfaces page; the DHCP server
   honours the reservation on every lease renewal (spec §7 / N1).

## 1. Enrolment-token management

### New endpoint

```
DELETE /edge-api/v1/network/enrol-tokens/{tokenHash}  (ADMIN)
→ 200 { "revoked": true }
```

A token is "revoked" by force-expiring the row —
`consumed_at = now(), consumed_by_device = 'REVOKED'`. The row
sticks around for audit so operators can see who tried what.
`ENROL_TOKEN_REVOKED` audit event fires on success.

`GET /network/enrol-tokens` now also returns the `tokenHash` field
so the UI can address rows for revoke.

### UI — new panel on Connected Devices

```
Enrolment tokens · n outstanding               [Refresh]
┌────────────────────────────────────────────────────────────┐
│ Token (truncated)   Hint        Issued   Expires   Status  │
├────────────────────────────────────────────────────────────┤
│ bVgDGUF5fmjt67l0…   TAB-DEMO-01 2 min    28 min    ACTIVE ⋮│
│ Mm7wCyTNTafJjZjC…   —           3 h       —        CONSUMED│
│ 845c69a1bd777cab…   REVOKE-ME   5 min     —        REVOKED │
└────────────────────────────────────────────────────────────┘
```

Row-menu offers **Revoke** on live tokens only; consumed /
expired / already-revoked rows are display-only. Status chip
colouring: ACTIVE/CONSUMED → success · EXPIRED → muted · REVOKED
→ danger.

## 2. TLS certificate panel (spec §11)

### New endpoint

```
GET /edge-api/v1/network/tls
→ {
    subject: "CN=der.local, O=DER Edge",
    issuer:  "CN=DER Internal CA, O=DER Edge",
    algorithm: "Ed25519",
    fingerprint: "66:7C:69:12:31:D7:…",
    publicKeyBase64: "MCowBQYDK2VwAyEA…",
    notBefore: "2026-10-29T06:21:10Z",
    notAfter:  "2036-10-26T06:21:10Z",
    san: ["der.local", "10.88.0.1"],
    renewable: true
  }
```

For 2.1.92 the TLS cert *is* the DER internal CA — the N2 trust
story treats the edge as its own authority. A dedicated server-cert
rotation flow lives behind the agent in a later deploy.

### UI — Security page gains a TlsCertPanel

```
┌───────────────────────────────────────────────────────┐
│  TLS certificate — https://der.local  [Download pubkey]│
├───────────────────────────────────────────────────────┤
│  Status       ✓ 3650 days until expiry                │
│  Subject      CN=der.local, O=DER Edge                │
│  Issuer       CN=DER Internal CA, O=DER Edge          │
│  Algorithm    Ed25519                                 │
│  Fingerprint  66:7C:69:12:31:D7:32:…                  │
│  SAN          der.local, 10.88.0.1                    │
│  Not before   Oct 29, 2026, 11:56 AM                  │
│  Not after    Oct 26, 2036, 11:56 AM                  │
└───────────────────────────────────────────────────────┘
```

Status chip tone changes with days-until-expiry:

- `≥30 days` → success
- `<30 days` → warning
- `≤0 days`  → danger (shows `EXPIRED`)

**Download pubkey** writes a PEM-wrapped Base64 blob
(`-----BEGIN PUBLIC KEY-----` wrapper, 64-column body) so
operators can trust-pin DER from a device.

## 3. Static DHCP lease management

### New endpoints

```
POST   /edge-api/v1/network/leases/static  (ADMIN)
  body: { mac, ip, hostname? }
  → 201 { pinned: true }

DELETE /edge-api/v1/network/leases/{mac}   (ADMIN)
  → 200 { deleted: true }
```

Static leases are stored with `static_lease = true` and
`expires_at = now() + 10 years`, so they never fall out of the
"active" view. `STATIC_LEASE_SET` / `LEASE_REMOVED` audit events.

### UI — Interfaces page

The DHCP leases panel now has:

- **Pin static lease** primary action in the header → opens
  `StaticLeaseDialog` (MAC / IP / hostname).
- Each lease row has a row-menu with **Delete lease** (danger).
- Kind column now shows a Status chip (STATIC → info · DYNAMIC → muted).

### Lease upsert semantics

`insertStaticLease` is idempotent — ON CONFLICT (mac) DO UPDATE
rewrites the IP and hostname and forces `static_lease = TRUE`.
Operators can safely re-pin a device to a different IP without
first deleting the old row.

## 4. Live assertions

```
Server endpoints:
  GET  /tls              → 200
  GET  /mdns             → 200
  GET  /enrol-tokens     → 200

Token lifecycle:
  POST /enrol-tokens     → token=bVgDGUF5fmjt67l0IRzX…
  DELETE /enrol-tokens/{hash} → 200

Static lease:
  POST /leases/static    → 201
  GET  /leases           → count=1 (pinned present)
  DELETE /leases/{mac}   → 200

UI assertions:
  /network/clients
    "Enrolment tokens · N outstanding" panel present:  true
  /network/security
    "TLS certificate — https://der.local" present:     true
    "DER Internal CA" issuer rendered:                 true
    "3650 days until expiry" status chip visible:      true
  /network/interfaces
    "Pin static lease" button present:                  true
    Pin dialog opens, Save adds a new row:              true

Total pageerrors: 0
```

Screenshot `/tmp/der-2.1.92-security.png` shows the Security page
with the firewall policy table above the full TLS certificate card
and Download pubkey button in the panel header.

## 5. Files changed

```
server/src/main/java/ug/ac/mak/der/network/NetworkRepository.java   — enrol-token revoke, static-lease upsert/delete, token row includes token_hash + issued_by
server/src/main/java/ug/ac/mak/der/network/NetworkService.java      — revokeEnrolToken, pinStaticLease, deleteLease, tlsCertificate, mdnsServices
server/src/main/java/ug/ac/mak/der/web/NetworkController.java       — DELETE /enrol-tokens/{hash}, POST /leases/static, DELETE /leases/{mac}, GET /tls, GET /mdns + StaticLeaseBody
admin-ui/src/screens/Network.tsx                                   — EnrolTokensPanel on Clients, TlsCertPanel on Security, StaticLeaseDialog + row-menu delete on Interfaces
admin-ui/src/api/edgeApi.ts                                        — networkEnrolTokenRevoke, networkLeasePin/Delete, networkTls, networkMdns + NetworkEnrolToken.tokenHash field
```

## Build + test

```
tsc -b && vite build          ✓ 1759 modules → 636.95 KB
./mvnw -q -DskipTests package ✓ 2.1.92 JAR built
Live Playwright E2E           ✓ 0 pageerrors, every new flow green
```
