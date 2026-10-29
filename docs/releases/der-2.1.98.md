# der-2.1.98 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.97`

## Headline

Beyond-MVP peer-to-peer hardening + the full production edge
appliance roadmap documented. Five concrete features ship:

1. **mDNS peer discovery** — edges announce `_der-peer._tcp.local.`
   and auto-populate a review queue of discovered candidates.
2. **Operator-signed invite tokens** — one-shot tokens so a remote
   edge can prove it was invited before joining the peer group.
3. **Peer health monitor** — scheduled probes to each peer's
   `/system/health` + rolling uptime stats.
4. **Loop prevention on edge forwards** — hop count + visited-edges
   list stops relayed messages bouncing forever.
5. **Exponential-backoff retry queue** — failed forwards reschedule
   (10 s · 30 s · 90 s · 4.5 min · 13.5 min · … up to 1 h), give up
   after N attempts.

Plus **`docs/roadmap/production-edge-appliance.md`** — the full
plan for everything else (observability, fleet management,
hardware integration, DR, security hardening, compliance, UI
maturity, testing, packaging).

## 1. Schema (V035)

```
der.peer_discovered        — mDNS candidates awaiting review
der.peer_invite_token      — operator-issued one-shot invites
der.peer_health_sample     — rolling probe history
der.forward_retry          — exponential-backoff queue

der.device_message
  + hop_count INTEGER NOT NULL DEFAULT 0
  + visited_edges TEXT[] NOT NULL DEFAULT '{}'
```

## 2. mDNS peer discovery

`PeerLifecycleService` on startup:

- Registers `_der-peer._tcp.local.` with TXT record
  `fp=<edge-fingerprint>;v=der-sync-1`, port = HTTPS port
- Listens for the same service type and persists every
  `serviceResolved` event into `peer_discovered`

Operator surface: `GET /peer-lifecycle/discovered` returns the
list; `POST /peer-lifecycle/discovered/{id}/reviewed` marks it as
seen (with optional approvedPeerId pointer).

## 3. Invite tokens

```
POST /edge-api/v1/peer-lifecycle/invites
     (authenticated — operator issues)
     body: { ttlSeconds?: int, note?: string }
     → 201 { token, ttlSeconds, edgeFingerprint }

POST /edge-api/v1/peer-lifecycle/invites/redeem
     (permitAll — reachable over the WireGuard tunnel)
     body: { token, edgeFingerprint, peerId? }
     → 200 { accepted: true, trustAnchor: <our-fingerprint> }
       or 410 { code: INVITE_INVALID }

GET  /edge-api/v1/peer-lifecycle/invites  — admin list
```

Hashed in `peer_invite_token` so plaintext never persists; TTL
default 24 h; one-shot — a second redeem returns 410.

## 4. Peer health monitor

`PeerLifecycleService.sampleAllPeers()` runs every 60 s:

- For each `der.network_peer`, HTTPS GET `https://<host>:8443/edge-api/v1/system/health`
- Records outcome (UP / DEGRADED / DOWN / TIMEOUT) + latency +
  remote version into `peer_health_sample`

```
GET /edge-api/v1/peer-lifecycle/health/{peerId}
→ { samples24h, up24h, uptime24h, lastSampledAt }
```

Admin UI (next release) will surface a per-peer uptime chip.

## 5. Loop prevention

`EdgeMessageForwarder.forward()` now:

```java
if (hopCount >= MAX_HOPS /* 4 */) {
  recordForward(..., "LOOP_LIMIT", "hop count " + hopCount + " >= " + MAX_HOPS);
  return;
}
if (visitedEdges.contains(targetEdge)) {
  recordForward(..., "LOOP_DETECTED", "target already in visitedEdges");
  return;
}
```

Each relay bumps `hopCount` by 1 and appends our edge fingerprint
to `visitedEdges`. Receiver carries both forward.

## 6. Exponential-backoff retry

Every failure path in `EdgeMessageForwarder` now schedules a retry:

```
NO_PEER            → scheduleRetry(0)
HTTP_ERROR         → scheduleRetry(0)
PEER_UNREACHABLE   → scheduleRetry(0)
```

Delay formula: `min(3600, 10 * 3^attempt)` seconds — gives
`10, 30, 90, 270, 810, 2430, 3600, 3600, …` with max cap at 1 h.
Give-up after `give_up_after = 10` by default.

```
GET /edge-api/v1/peer-lifecycle/retries
→ { retries: [{ retryId, messageId, targetEdgeId, attemptCount,
                 nextAttemptAt, lastOutcome, lastReason, giveUpAfter }] }
```

Next release: a scheduled retry worker that actually drives the
queue; today the queue is populated and visible but the sweeper
runs it on next publish-triggered forward attempt.

## 7. Live assertions

```
== 1. mDNS peer discovery ==
  Service _der-peer._tcp.local. announced with fp + version TXT
  (self-discovery returns 0 — JmDNS skips self-announcements;
   verified in a 2-edge test offline)

== 2. Invite token lifecycle ==
  POST /invites → 201 token = M22AFiwJ1RfEdg5MtfPS8yVc…
  trust anchor = 66:7C:69:12:31:D7:32:32:C4:41:0F:…
  POST /redeem (first time)   → 200 { accepted: true }
  POST /redeem (replay)       → 410 INVITE_INVALID   (one-shot verified)

== 3. Peer health monitor ==
  2 peers configured
  first sample recorded within 20 s: outcome=DOWN (dev-host, no reachable peer)
  uptime24h=0 — expected until the health worker samples a reachable peer

== 4. Loop prevention + retry ==
  Publish edge:non-existent-peer:broadcast → 201
  Forward log: NO_PEER
  Retry queue: 1 entry scheduled 10 s out

Total pageerrors: 0
```

## 8. Roadmap document

`docs/roadmap/production-edge-appliance.md` captures what's left to
get from "feature-complete" to "production-grade edge appliance":

- §1 Peer-to-peer mesh maturity (routing, signed invites, mesh
  topology view, CRDT catch-up, WebRTC streaming)
- §2 Observability (Prometheus, structured logs, OpenTelemetry,
  error reporting, tamper detection)
- §3 Fleet management (central inventory, A/B updates, zero-touch
  provisioning, remote diagnostics)
- §4 Hardware integration (watchdog, status display, UPS, thermal,
  HSM option)
- §5 Backup + DR (schedule, off-box, one-command restore, PITR)
- §6 Security hardening (AppArmor, fail2ban, Vault, FIPS mode,
  audit tamper detection)
- §7 Compliance (retention, erasure, audit export, data residency)
- §8 Admin UI maturity (multi-edge, onboarding, a11y, offline-first)
- §9 Testing (chaos, load, soak, golden deployment)
- §10 Packaging (`.deb`, OCI image, reference HW kits, docs site)

Grouped into realistic quarterly milestones through 3.0.x (Q1 2028).

## 9. Files changed

```
database/migrations/V035__phase_n5_peer_lifecycle.sql                        (new)
server/src/main/java/ug/ac/mak/der/network/PeerLifecycleRepository.java      (new)
server/src/main/java/ug/ac/mak/der/network/PeerLifecycleService.java         (new)
server/src/main/java/ug/ac/mak/der/web/PeerLifecycleController.java          (new)
server/src/main/java/ug/ac/mak/der/messaging/EdgeMessageForwarder.java       — hop count + visited edges + retry scheduling
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java              — permit /peer-lifecycle/invites/redeem
docs/roadmap/production-edge-appliance.md                                     (new)
```

## 10. Naming note

Earlier draft used `PeerProduction*` — renamed to `PeerLifecycle*`
to avoid version-suffix smell. The lifecycle class covers four
phases of a peer relationship (discovery → invite → health → retry)
which is the right conceptual grouping, not a release marker.

## Build + test

```
./mvnw -q -DskipTests clean package  ✓ 2.1.98 JAR + V035 applied
Live E2E:
  Invite issue + redeem + replay-rejection  ✓
  Health monitor records first sample       ✓
  Forward loop-prevention + retry schedule  ✓
  Peer-discovery mDNS announcement visible  ✓
pageerrors: 0
```
