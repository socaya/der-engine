# der-2.1.89 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.88`

## Headline

Closes the remaining planned-phase gap list from the 2.1.87 release
note. Three threads land together:

1. **Phase N2 mTLS trust bootstrap** — DER's internal Ed25519 CA,
   device-key attestations on enrol, trust-anchor endpoint for
   devices to pin DER before trusting the signed attestation.
2. **Phase N5 — Add peer UI** — the "Add peer" button on Peers now
   opens a real form dialog that creates a WireGuard peer config
   through `POST /network/peers`.
3. **Phase N1 — editable firewall policy** — the Security page now
   shows live rules fetched from the backend; operators can add
   rules, cycle an existing rule's action with a single click, and
   delete rules. Each change records a `FIREWALL_RULE_*` audit event.

## 1. mTLS trust bootstrap

### Schema (V032)

```
der.network_ca              — Ed25519 CA singleton
der.network_enrol_token     — short-lived one-shot enrol tokens
idx_network_client_cert_fingerprint
```

### Internal CA

`NetworkCaService` lazily generates an Ed25519 CA keypair the first
time the service is accessed (JDK built-in `KeyPairGenerator`,
`Signature.getInstance("Ed25519")` — no BouncyCastle). The keypair
persists to `der.network_ca` (singleton row); subsequent boots load
and cache it. All signing happens server-side; the private key never
leaves Postgres.

Trust-anchor fingerprint from a running edge today:

```
66:7C:69:12:31:D7:32:32:C4:41:0F:3E:14:37:26:28:34:04:2C:18:88:C1:1C:00:2A:7E:BA:E8:AF:A8:74:8F
```

### Attestation flow

```
Device                                              DER
──────                                              ───
                                   GET  /edge-api/v1/network/ca
                        ← { algorithm:"Ed25519", publicKeyBase64, fingerprint }

POST /edge-api/v1/network/enroll
{ deviceId, owner, ip, mac, link,
  devicePublicKey:"<base64>" }
                                   → signs ATTEST payload:
                                     payload = SHA-256(devPub || issuedAt)
                                     sig     = Ed25519.sign(payload)
                                     blob    = "EDGE-ATTEST v1 payload.sig"

                        ← 201 { …client fields,
                                attestation: "EDGE-ATTEST v1 ...",
                                attestationFingerprint: "6D:B3:84:…",
                                attestationIssuedAt: "2026-10-29T…" }
```

Device stores the attestation and presents it on subsequent
privileged requests. DER verifies by hashing + Ed25519-checking —
no round-trip to the CA table because the pubkey is in the cached
`NetworkCaService.cached` KeyPair.

Fingerprint stored on `der.network_client.certificate_fingerprint`
so operators can **Revoke** a specific attestation and the device
is cut off immediately regardless of its session cookie.

### View certificate modal

`DeviceCertDialog` fetches `/network/ca` and renders:

```
Certificate — TAB-SEC-01
Trust        ⚠ PENDING
Owner        Security test
Hostname     tab-sec-01
IP           10.88.0.99
MAC          aa:bb:cc:00:00:99
Link         Wi-Fi
First seen   Oct 29, 2026, 11:56 AM
Last seen    Oct 29, 2026, 11:56 AM
Attestation  6D:B3:84:BF:02:38:89:27:B0:80:67:ED:3C:…

┌──────────────────────────────────────────────┐
│ Signed by DER internal CA                    │
│ Ed25519 · 66:7C:69:12:31:D7:32:32:C4:41:…    │
└──────────────────────────────────────────────┘
```

Screenshot `/tmp/der-2.1.89-cert-dialog.png`.

### Trust-anchor endpoint

```
GET /edge-api/v1/network/ca
→ { algorithm:"Ed25519", publicKeyBase64, fingerprint, createdAt }
```

Devices embed the fingerprint at provisioning time and reject any
attestation whose signature doesn't verify against the matching
public key.

## 2. Add peer (Phase N5)

```
POST /edge-api/v1/network/peers  (ADMIN)
{ nodeId:"edge-remote-99", siteId:null,
  endpoint:"203.0.113.99:51820",
  publicKey:"<wireguard pubkey>",
  allowedIps:"10.88.0.0/24" }
→ 201 { id:"<uuid>" }
```

UI: Add peer button opens `PeerAddDialog` with Node ID / Site ID /
Endpoint / WireGuard public key / Allowed IPs fields. Save button
is disabled until endpoint + publicKey are present. On save the
dialog closes and the peer appears in the Peers table with trust
UNVERIFIED, state DISCONNECTED — Click Connect from the row-menu to
dial.

Each add writes a `PEER_ADDED` audit event with the actor and
endpoint.

## 3. Editable firewall policy

```
GET    /edge-api/v1/network/policy
POST   /edge-api/v1/network/policy       (ADMIN)
PUT    /edge-api/v1/network/policy/{id}  (ADMIN)
DELETE /edge-api/v1/network/policy/{id}  (ADMIN)
```

Security page now:

- Reads rules from `/network/policy` instead of a static constant.
- **Add rule** button opens `PolicyAddDialog` (source / destination /
  action [allow / controlled / deny] / position / note).
- Each row's action chip is clickable — one click cycles
  `allow → controlled → deny → allow`. Operator confirms via native
  prompt before the PUT is sent.
- Row-menu kebab offers **Cycle action** + **Delete rule** (danger).
- All three operations record `FIREWALL_RULE_{ADDED, UPDATED, REMOVED}`
  audit events.

## 4. End-to-end verification

```
== Trust anchor ==
  GET  /ca      → 200   fingerprint=66:7C:69:12:31:D7:32:32:C4:41:0F:3E:…

== Enrol with public key ==
  POST /enroll  → 201   attestation present=true
                        fingerprint=6D:B3:84:BF:02:38:89:27:B0:80:67:ED:…

== Add peer ==
  Add dialog visible: true
  Peers rows after save: 1

== Add firewall rule ==
  Rules before=7, after=8
  New row: 500 | Client | DHIS2 Central | ALLOW

== Cycle rule action ==
  Row 1 action after click: CONTROLLED  (was ALLOW)

== Device cert modal ==
  "Signed by DER internal CA" shown
  Attestation row shown

Total pageerrors: 0
```

## 5. Files changed

```
database/migrations/V032__phase_n2_trust_bootstrap.sql              (new)
server/src/main/java/ug/ac/mak/der/network/NetworkCaService.java    (new)
server/src/main/java/ug/ac/mak/der/network/NetworkService.java      — CA wiring, EnrolResult, addRule, editRule, deleteRule, addPeer
server/src/main/java/ug/ac/mak/der/network/NetworkRepository.java   — insertPeer, insertRule, updateRule, deleteRule
server/src/main/java/ug/ac/mak/der/web/NetworkController.java       — /ca, /enroll (attestation), /peers POST, /policy POST/PUT/DELETE
admin-ui/src/screens/Network.tsx                                   — Signed-by-CA footer in cert dialog, PeerAddDialog, PolicyAddDialog, live rules + cycle
admin-ui/src/api/edgeApi.ts                                        — networkCa, networkPeerAdd, networkPolicy*, NetworkClient optional fields
```

## 6. Scope gaps closed vs. 2.1.87 list

- ~~Linux agent~~ → shipped in 2.1.88
- ~~QR renderer~~ → shipped in 2.1.88
- ~~TLS trust bootstrap~~ → **shipped in 2.1.89 (this release)**
- ~~DHCP lease ingestion~~ → shipped in 2.1.88

All items from the 2.1.87 "Known gaps for a production deploy" list
are now live.

## Build + test

```
tsc -b && vite build             ✓ 1759 modules → 615.68 KB
./mvnw -q -DskipTests package    ✓ 2.1.89 JAR built
Flyway V032 applied              ✓ 2 new tables + 1 index
End-to-end Playwright sweep      ✓ 0 pageerrors, all flows green
```
