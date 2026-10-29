# der-2.1.96 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.95`

## Headline

**DER-MSG v1 — device-to-device messaging bus within one edge.** The
tablets and phones joined to the DER-EDGE Wi-Fi can now exchange
data pairwise, by role, or by broadcast — mediated by DER as broker
so delivery survives offline windows and every exchange lands in
the audit.

## 1. Protocol — DER-MSG v1

```
Device A  ─── POST /messaging/publish ────▶  DER broker
                                            │
                                            ├─ store in der.device_message
                                            │
Device B  ─── GET /messaging/recent?since ─┤
Device C  ─── GET /messaging/recent?since ─┤
                                            └─ cursor-based catch-up
```

### Channel kinds (routed by prefix)

| Prefix | Example | Routing |
|---|---|---|
| `device:<id>`   | `device:TAB-REG-01` | Direct to one device |
| `role:<name>`   | `role:lab`           | Every device subscribed to `role:lab` |
| `broadcast`     | `broadcast`          | Every device subscribed to broadcast |

Direct messages (`device:<id>`) are received without an explicit
subscription — a tablet always gets its own mail. Role + broadcast
require the device to `POST /messaging/subscribe`.

### Delivery semantics

- **At-least-once** via cursor-based catch-up (the receiver's cursor
  advances only when they commit it)
- **Idempotent** — `messageId` is a UUID chosen by DER; redelivery
  is safely deduped on the client side
- **Durable** — persisted in `der.device_message` so devices that
  reconnect after an offline window get everything they missed
  (minus any messages whose `expiresAt` has elapsed)
- **TTL** — optional `ttlSeconds` on publish; expired messages are
  reaped every 5 minutes

### Message types (v1 vocabulary)

```
REFERRAL_INTERNAL   patient referred from reception to the lab
STOCK_ALERT         drug/supply running low at a workstation
PATIENT_HANDOFF     vitals + queue slot handed from clinician to clinician
CHAT                free-form operator message
PRESENCE            device joined / left the edge
```

Operators extend by just publishing with any `messageType` string —
DER doesn't validate the vocabulary.

## 2. Schema (V033)

```
der.device_message       — append-only broker log
der.device_subscription  — per-device channel + cursor
der.device_message_ack   — optional per-device processed receipt
```

Indexes: `(channel, created_at DESC)`, `(from_device_id, created_at
DESC)`, partial `(expires_at) WHERE NOT NULL`. The reaper trims
`expires_at < now()` every 5 minutes.

## 3. REST surface

### Device-facing

```
POST   /edge-api/v1/messaging/publish        body: { channel, fromDeviceId, messageType, payload, replyTo?, ttlSeconds? }
GET    /edge-api/v1/messaging/recent?deviceId=X&since=Y&limit=50
POST   /edge-api/v1/messaging/ack/{messageId}?deviceId=X
POST   /edge-api/v1/messaging/subscribe      body: { deviceId, channel }
DELETE /edge-api/v1/messaging/subscribe?deviceId=X&channel=Y
POST   /edge-api/v1/messaging/cursor         body: { deviceId, channel, cursor }
```

### Admin-facing

```
GET /edge-api/v1/messaging/stats          — total / subscribed / channels active / last-hour counts + top-24h leaderboard
GET /edge-api/v1/messaging/log?limit=100  — recent-messages feed across every channel
GET /edge-api/v1/messaging/subscriptions  — per-device subscription state + last-poll freshness
```

All routes authenticated — devices join via the existing session
cookie or an enrol-token exchange. No role gating beyond
authentication; the trust model is "if you're on DER-EDGE Wi-Fi,
you can talk to peers through DER".

## 4. UI — new "Device messaging" sub-page

`/network/messaging` ships in this release. Panels:

- **Status strip**: `N messages · N devices subscribed · N channels
  active · N last hour`
- **Top channels (last 24 h)**: ranked leaderboard
- **Recent messages**: auto-refreshing every 5 s, 25/page, shows
  when / channel / from device / type / payload preview / expires
- **Device subscriptions**: live subscription list with last-poll
  freshness chip (success if polled in last 60 s, muted otherwise)
  + row-menu Unsubscribe
- **Publish dialog**: operator demo flow — channel / message type /
  TTL minutes / JSON payload

Icon added to the Network sub-nav: a waveform (`activity`) tab
between Diagnostics and Settings.

## 5. End-to-end verification

```
== DER-MSG v1 — three-channel delivery ==
  Publish device:TAB-A      → 201 (PATIENT_HANDOFF)
  Publish role:lab          → 201 (REFERRAL_INTERNAL, 1 h TTL)
  Publish broadcast         → 201 (STOCK_ALERT)

  TAB-A polls (subscribed broadcast + role:lab):
    device:TAB-A · PATIENT_HANDOFF    ✓
    role:lab     · REFERRAL_INTERNAL  ✓
    broadcast    · STOCK_ALERT        ✓

  TAB-B polls (subscribed broadcast only):
    broadcast    · STOCK_ALERT        ✓
    (role:lab + direct NOT delivered — isolation correct)

  Stats:
    messagesTotal=3  devicesSubscribed=2  channelsActive=3
    topChannels: broadcast/1 · device:TAB-A/1 · role:lab/1

== UI /network/messaging ==
  page loaded:                   true
  Recent messages table rows:    4
  Device subscriptions rows:     3
  Publish dialog opens:          true
  pageerrors:                    0
```

Screenshot `/tmp/der-2.1.96-messaging.png` shows the Device
messaging page with Top channels + Recent messages (4 rows across
broadcast / device:TAB-A / role:lab) + Device subscriptions.

## 6. Scope + non-goals

**Implemented:**
- The three channel kinds + routing
- At-least-once delivery with idempotent dedupe
- Durable store + TTL reaper
- Admin console with live stats + subscription view
- 5-second auto-refresh poll loop

**Not implemented in v1:**
- **CRDT client mesh** (spec §31 explicit out-of-scope). Devices
  don't talk directly to each other over Wi-Fi Direct; DER
  mediates.
- **Server-Sent Events / WebSocket push**. Polling is good enough
  for the 5–10 s latency targets in a facility; SSE is a candidate
  for v2.
- **Encrypted payloads at rest**. Payloads land in `der.device_message`
  in cleartext; the DER internal CA + HTTPS listener protect them in
  flight. End-to-end encryption with per-device keys is a candidate
  for v2.
- **Delivery receipts in the UI**. The ack endpoint persists per
  `(messageId, deviceId)` but the admin page doesn't yet surface
  "N devices have processed" counts — small follow-up.

## 7. Files changed

```
database/migrations/V033__phase_n5_device_messaging.sql           (new)
server/src/main/java/ug/ac/mak/der/messaging/DeviceMessageRepository.java  (new)
server/src/main/java/ug/ac/mak/der/messaging/DeviceMessageService.java     (new)
server/src/main/java/ug/ac/mak/der/web/DeviceMessageController.java        (new)
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java   — permit /messaging/** (authenticated)
admin-ui/src/screens/DeviceMessaging.tsx                           (new)
admin-ui/src/App.tsx                                              — route /network/messaging
admin-ui/src/app/navigation.ts                                    — "Device messaging" sub-tab (activity icon)
admin-ui/src/api/edgeApi.ts                                       — DeviceMessage + Subscription types + 8 helpers
```

## Build + test

```
tsc -b && vite build          ✓ 1759 modules → 657.22 KB
./mvnw -q -DskipTests package ✓ 2.1.96 JAR built; Flyway V033 applied
Playwright 3-channel sweep    ✓ broadcast + role fan-out + direct DM all deliver correctly, 0 pageerrors
```
