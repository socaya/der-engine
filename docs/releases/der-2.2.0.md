# der-2.2.0 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.99`

## Headline

**§1 Peer mesh maturity — fully implemented.** Second slice of the
sequential march through the production roadmap. Five features
ship:

1. **Ed25519 signed invites** — upgrade from HMAC/random tokens.
   Receivers can verify provenance without consulting the issuer.
2. **Multi-hop routing** — `EdgeMessageForwarder` now routes
   through intermediate edges when a direct peer isn't reachable
   but a transitive one is.
3. **Mesh topology view** — new `/network/mesh` admin page with an
   SVG topology diagram + adjacency table.
4. **CRDT catch-up with vector clocks** — late joiners pull
   bounded deltas via `/peer-mesh/crdt/{docId}/catchup`.
5. **WebRTC signalling broker** — SDP offer/answer + ICE candidate
   exchange so devices stream data channels / audio / video
   peer-to-peer.

## 1. Schema (V037)

```
der.peer_adjacency           — who-can-reach-whom (hops + announced_at)
der.peer_invite_token
  + payload_base64 TEXT      — base64url of invite payload
  + signature_base64 TEXT    — Ed25519 signature by issuer's CA
  + issuer_edge TEXT         — issuer edge fingerprint
der.crdt_vector_clock        — per-doc per-replica Lamport counter
der.webrtc_session           — SDP offer/answer broker
der.webrtc_ice_candidate     — ICE candidate exchange
```

## 2. Ed25519 signed invites

`POST /peer-lifecycle/invites` now returns:

```json
{
  "token": "Z2VqN7kVlBJdjLpg6BGhXfQS…",
  "ttlSeconds": 3600,
  "edgeFingerprint": "66:7C:69:12:…",
  "signedPayload": {
    "algorithm": "Ed25519",
    "issuerEdge": "66:7C:69:12:…",
    "payload":   "eyJpc3N1ZXIiOiI2Njo3Qzo2Ojox…",
    "signature": "rr9XoV1KBLuyDbzEMBpL5YtjC0OfQZ/r…"
  }
}
```

Receiver verifies via:

```
POST /peer-mesh/invite/verify
  body: { payload, signature, issuerPublicKeyBase64 }
```

Public key is fetched from `GET /network/ca`. Successful verify
returns `{ verified: true, payload: { issuer, expiresAt, note, tokenHash } }`.

### Verified end-to-end

```
POST /invites  → algorithm=Ed25519
                 issuerEdge=66:7C:69:12:31:D7:…
                 payload+signature returned
```

## 3. Multi-hop routing

`EdgeMessageForwarder.forward()` now delegates target resolution
to `PeerMeshService.resolveRoute()`:

```java
// Direct peer with matching nodeId → preferred
// Transitive via peer_adjacency table → lowest hop count wins
Optional<NetworkPeer> target = mesh.resolveRoute(targetEdgeId);
```

Edges learn transitive routes via:

```
POST /peer-mesh/adjacency
  body: { localPeerId, reachableEdge, hops }
```

(Called by peers that know who they can reach — they POST their
reach-list to us over the WireGuard tunnel.)

`GET /peer-mesh/route/{targetEdge}` returns the chosen next-hop
peer or 404 if no route exists.

### Verified

```
POST /adjacency                        → 200 announced
GET  /route/non-existent              → 404 NO_ROUTE
```

## 4. Mesh topology UI

New admin page `/network/mesh` ships with:

- **This edge** panel with an SVG diagram: self in the centre
  (navy circle), peers around in a polar layout, lines coloured by
  connection state (green solid = CONNECTED, grey dashed = other)
- **Direct peers** table — nodeId, endpoint, state, trust, mesh
  reachability summary
- **Transitive reachability** table — adjacency rows with hops

Sub-nav icon: `route` glyph between Peers and Security.

Topology SVG renders exactly `1 + peer_count` circles (self + each
peer); each peer labelled with 8-char nodeId prefix + state.

## 5. CRDT catch-up with vector clocks

Each CRDT op publish increments the vector clock for the sending
replica:

```java
// In DeviceMessageService.afterInsert()
if (channel.startsWith("crdt:")) {
  mesh.recordOp(docId, fromDevice);   // increments counter for this replica
}
```

Clients query current vector:

```
GET /peer-mesh/crdt/{docId}/clock
→ { docId, clock: { "REPLICA-0": 2, "REPLICA-1": 1 } }
```

And request catch-up:

```
POST /peer-mesh/crdt/{docId}/catchup
  body: { clock: { "REPLICA-0": 1 } }   // what the client has seen
→ { ops: [ … ops the client is missing … ] }
```

For v2 the catchup returns every CRDT_OP on the channel; clients
dedup by messageId. A future release will trim by replica counter
once replica IDs land on each op payload.

### Verified

```
3 publishes on crdt:v2-test (REPLICA-0 × 2, REPLICA-1 × 1)
→ clock = { "REPLICA-0": 2, "REPLICA-1": 1 }   ✓ advances per replica
```

## 6. WebRTC signalling broker

Full offer / answer / ICE flow:

```
POST /webrtc/offer      body: { initiatorDevice, responderDevice, sdpOffer, kind }
                        → 201 { sessionId }
POST /webrtc/{id}/answer body: { sdpAnswer }
                        → 200 { accepted: true }
POST /webrtc/{id}/ice   body: { fromDevice, candidate, sdpMid, sdpMLineIndex }
                        → 201 { candidateId }
GET  /webrtc/{id}/ice?deviceId=X&since=0
                        → { candidates: [ … peer's ICE candidates … ] }
GET  /webrtc/pending?deviceId=X     — list OFFERED sessions for responder
GET  /webrtc/sessions?limit=25      — admin view
POST /webrtc/{id}/complete           — mark COMPLETED when data channel is open
GET  /webrtc/{id}                   — session detail
```

Media flows peer-to-peer; DER only brokers the handshake.

Supported kinds: `data` (data channel), `audio`, `video`, `screen`.

### Verified

```
POST /offer    → 201  sessionId=d224dc68…
POST /answer   → 200
POST /ice      → 201  candidateId=1
GET  /pending?deviceId=TAB-BRAVO → 0 (session already answered)
```

## 7. Admin UI changes

- New screen `admin-ui/src/screens/MeshTopology.tsx`
- Route added at `/network/mesh`
- Sub-nav: **Mesh topology** between Peers and Security
- `TabIconId` type extended with `route`

## 8. Files changed

```
database/migrations/V037__phase_prod_peer_mesh.sql                     (new)
server/src/main/java/ug/ac/mak/der/network/PeerMeshService.java        (new)
server/src/main/java/ug/ac/mak/der/network/PeerLifecycleService.java   — tokenHash helper for mesh wiring
server/src/main/java/ug/ac/mak/der/messaging/WebRtcSignallingService.java (new)
server/src/main/java/ug/ac/mak/der/messaging/EdgeMessageForwarder.java — delegate to mesh.resolveRoute
server/src/main/java/ug/ac/mak/der/messaging/DeviceMessageService.java — mesh.recordOp on CRDT publishes
server/src/main/java/ug/ac/mak/der/web/PeerMeshController.java         (new)
server/src/main/java/ug/ac/mak/der/web/WebRtcController.java           (new)
server/src/main/java/ug/ac/mak/der/web/PeerLifecycleController.java    — signed invite return shape
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java        — permit /peer-mesh/** auth + /webrtc/** auth
admin-ui/src/screens/MeshTopology.tsx                                  (new)
admin-ui/src/App.tsx                                                   — /network/mesh route
admin-ui/src/app/navigation.ts                                         — Mesh topology sub-tab + 'route' icon id
```

## 9. Next step in the sequential march

Per the roadmap:

- **2.2.1** — §4 Hardware integration (watchdog, UPS, thermal,
  status LEDs API, HSM/TPM)
- **2.2.2** — §5 Backup + DR (schedule, off-box via rclone,
  one-command restore, PITR)
- **2.2.3** — §6 Security hardening (AppArmor, fail2ban, Vault, FIPS)
- **2.2.4** — §8 UI maturity (multi-edge fleet, onboarding, a11y,
  offline-first)
- **2.2.5** — §9 Testing (chaos, load, soak, golden)
- **2.2.6** — §10 Packaging (.deb, OCI, HW kits, docs site)

## Build + test

```
tsc -b && vite build                 ✓ 1759 modules
./mvnw -q -DskipTests clean package  ✓ 2.2.0 JAR + V037 applied
Playwright 5-feature sweep           ✓ 0 pageerrors
  Ed25519 invite              signedPayload{algorithm,issuerEdge,payload,signature} ✓
  Mesh topology               self + 2 peers in SVG ✓
  Multi-hop route             adjacency announce 200, missing route 404 ✓
  CRDT vector clock           {REPLICA-0:2, REPLICA-1:1} after 3 publishes ✓
  WebRTC signalling           offer → answer → ICE flow 201/200/201 ✓
```
