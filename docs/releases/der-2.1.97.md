# der-2.1.97 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.96`

## Headline

**DER-MSG v2 — the four v1 non-goals now ship.** SSE push for
sub-second latency, X25519 key registry + E2E encryption fields,
CRDT document type, and edge-to-edge message forwarding.

```
┌─────────────────────────────────────────────────────────┐
│  Phone A  ──POST /publish──▶  DER broker                │
│                                 │                        │
│         ┌───────────────────────┴───────┬──┬──────┐     │
│  SSE push to Phone B                   │  │      │     │
│  SSE push to Phone C                   │  │  edge:X     │
│                                        │  │  forward    │
│                                   crdt: doc index  ─▶ other DER
│                                                          │
│  Payload stored opaquely when encrypted=true (X25519+GCM)│
└─────────────────────────────────────────────────────────┘
```

## 1. SSE push (sub-second latency)

New endpoint:

```
GET /edge-api/v1/messaging/stream?deviceId=X
    Content-Type: text/event-stream

event: hello
data: { "deviceId":"X", "protocol":"der-msg", "version":"2.0" }

event: message
data: { messageId, channel, fromDeviceId, messageType, payload, … }
```

`MessageStreamDispatcher` keeps a `ConcurrentHashMap<deviceId,
List<SseEmitter>>` of live streams. When a message is published,
`afterInsert` resolves the target device set from the channel kind
(direct → one device; role/broadcast → every subscribing device)
and sends the message as an SSE event to every live emitter.

Dead emitters are dropped on IOException; the per-emitter 30-min
timeout and three lifecycle hooks (onCompletion / onTimeout /
onError) keep the map clean.

Admin page opens its own stream as `deviceId=ADMIN-UI` → the
subtitle shows **SSE live (N streams)** when connected, flips to
**SSE disconnected** on error. Panels auto-refresh on every SSE
event (no more 5-s poll waits).

### Verified

```
Publish device:SSE-TEST  ─▶  SSE listener receives in <1 s
Stream stats: liveDevices=1, liveStreams=1
```

## 2. Device key registry (X25519 + Ed25519)

```
POST /edge-api/v1/messaging/keys
  { deviceId, x25519PublicKeyBase64, ed25519PublicKeyBase64? }

GET  /edge-api/v1/messaging/keys/{deviceId}  → single row
GET  /edge-api/v1/messaging/keys              → all rows (admin)
```

New table `der.device_crypto_key`. X25519 is the ECDH key used
for E2E encryption; Ed25519 is reused from the Phase N2 trust
bootstrap. Senders fetch the recipient's X25519 pubkey before
publishing an encrypted direct message.

Admin page gets a **Device cryptographic keys** panel showing the
registered pubkeys per device with their truncated prefix + last
update.

## 3. End-to-end encryption of direct messages

The server never decrypts payloads. Clients handle:

1. `GET /messaging/keys/{recipientDeviceId}` → recipient's X25519 pubkey
2. Generate an **ephemeral** X25519 keypair
3. ECDH: `shared = X25519(ephemeralPriv, recipientPub)`
4. HKDF-SHA256(shared) → AES-256-GCM key
5. Encrypt `{patient, vitals, …}` → `(ciphertext, nonce)`
6. `POST /messaging/publish` with `encrypted=true, ciphertext,
   senderEphemeralPubkey, nonce`
7. Receiver: ECDH with its static priv + sender's ephemeral pub →
   derive the same AES key → decrypt

New columns on `der.device_message`: `encrypted`, `recipient_device_id`,
`sender_ephemeral_pubkey`, `nonce`.

### UI

Recent messages table shows an **E2E** chip next to the message
type and renders payload as `(encrypted — server opaque)` when
`encrypted=true`. Admins see the metadata but not the plaintext.

### Verified

```
Publish encrypted PATIENT_HANDOFF to device:TAB-ALPHA
  encrypted:true, recipient=TAB-ALPHA, sender ephemeral present, nonce present
Recipient-poll /messaging/recent?deviceId=TAB-ALPHA:
  encrypted flag round-trip: true
  payload is ciphertext: true
  server never saw plaintext
```

## 4. CRDT document type (LWW-Map)

Channel prefix **`crdt:<docId>`** triggers document registration.
First op creates the row in `der.crdt_document`:

```
doc_id       = patient-queue-triage
doc_type     = LWW_MAP          (operator can override via extension)
created_by   = <device that first published>
op_count     bumped on each op
last_op_at   bumped on each op
```

Ops themselves route through the normal messaging bus with
`messageType=CRDT_OP`. Clients handle the merge (LWW rules:
higher wall-clock timestamp wins; ties break by replica ID).
DER just forwards opaque ops.

New endpoint `GET /messaging/documents` lists the index. Admin
page's **CRDT documents** panel shows every doc + its op count.

### Verified

```
Publish crdt:patient-queue-triage with CRDT_OP:
  { key: "K-002", value: {position:1, priority:"high"}, clock: 1 }
Documents:
  patient-queue-triage (LWW_MAP, ops=1, lastOpAt=5s ago)
```

## 5. Edge-to-edge message forwarding

Channel prefix **`edge:<peerNodeId>:<subchannel>`** triggers an
`@Async` `EdgeMessageForwarder` that:

1. Looks up a CONNECTED + TRUSTED peer whose `node_id` matches
   `<peerNodeId>` (operator sets this when adding a peer)
2. Rewrites `channel` to just `<subchannel>` (so the receiver
   doesn't re-forward forever)
3. POSTs `[{...message, relayedFromEdgeId: our-fingerprint}]`
   to `https://<peer-host>:8443/edge-api/v1/messaging/relay`
4. Records the outcome in `der.message_forward_log`

Receiver: `POST /messaging/relay` is permitAll (trust comes from
the WireGuard tunnel) and ingests the batch into its own
`device_message` table + fans out via SSE to local subscribers.

Admin page's **Edge-to-edge forwards** panel shows the attempt log
with target edge, outcome chip (SUCCESS / NO_PEER / HTTP_ERROR /
PEER_UNREACHABLE), HTTP status, and reason.

### Verified

```
Publish edge:remote-edge-99:broadcast (no matching peer):
  Forward log: remote-edge-99 → NO_PEER
               "no TRUSTED+CONNECTED peer with nodeId=remote-edge-99"
```

(When a real peer is added via `/network/peers` and the WireGuard
tunnel comes up, SUCCESS outcomes land in the same log.)

## 6. Schema (V034)

```
ALTER TABLE der.device_message
  ADD encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD recipient_device_id TEXT,
  ADD sender_ephemeral_pubkey TEXT,
  ADD nonce TEXT;

der.device_crypto_key      — X25519 + Ed25519 public key registry
der.crdt_document          — CRDT doc index (op count + last op)
der.message_forward_log    — edge-to-edge relay attempt audit
```

## 7. Live assertions

```
== 1. SSE push ==
  SSE events received: 1  (device:SSE-TEST / PATIENT_HANDOFF)
  stream stats: liveDevices=1, liveStreams=1

== 2. Device key registry ==
  POST /keys → 201
  GET  /keys/TAB-ALPHA → x25519 pubkey round-trips

== 3. E2E encrypted direct message ==
  Publish encrypted=true → 201
  Recipient poll:
    encrypted flag round-trip: true
    payload is ciphertext:     true  (server opaque)

== 4. CRDT document ==
  Publish crdt:patient-queue-triage CRDT_OP → 201
  Documents: patient-queue-triage LWW_MAP ops=1

== 5. Edge-to-edge forward ==
  Publish edge:remote-edge-99:broadcast → 201
  Forward log: NO_PEER  "no TRUSTED+CONNECTED peer with nodeId=remote-edge-99"

== 6. UI ==
  SSE status chip visible (live)
  All 6 panels present:
    Top channels (24 h) · Recent messages · Device subscriptions ·
    Device cryptographic keys · CRDT documents · Edge-to-edge forwards

pageerrors: 0
```

Screenshot `/tmp/der-2.1.97-v2.png` shows the full page: SSE
chip in the subtitle, 7 top channels including the new `edge:` and
`crdt:` prefixes, encrypted messages shown as **"E2E"** chip +
`(encrypted — server opaque)` payload, and all three new v2
panels at the bottom populated.

## 8. Files changed

```
database/migrations/V034__phase_n5_messaging_v2.sql                     (new)
server/src/main/java/ug/ac/mak/der/DerApplication.java                  — @EnableAsync for forwarder
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java         — permit /messaging/relay
server/src/main/java/ug/ac/mak/der/messaging/MessageStreamDispatcher.java (new)
server/src/main/java/ug/ac/mak/der/messaging/MessagingV2Repository.java  (new)
server/src/main/java/ug/ac/mak/der/messaging/EdgeMessageForwarder.java   (new)
server/src/main/java/ug/ac/mak/der/messaging/DeviceMessageRepository.java — encrypted/recipient/ephemeral/nonce columns, SELECT updated
server/src/main/java/ug/ac/mak/der/messaging/DeviceMessageService.java   — v2 publish overload + SSE fan-out + CRDT index + edge forward
server/src/main/java/ug/ac/mak/der/web/DeviceMessageController.java     — /stream + /keys + /documents + /relay + /forwards endpoints
admin-ui/src/screens/DeviceMessaging.tsx                                — SSE client, "E2E" chip, 3 new panels
admin-ui/src/api/edgeApi.ts                                             — v2 helpers
```

## Build + test

```
tsc -b && vite build          ✓
./mvnw -q -DskipTests package ✓ 2.1.97 JAR + Flyway V034
E2E Playwright sweep          ✓ SSE + E2E + CRDT + edge-forward all green, 0 pageerrors
```
