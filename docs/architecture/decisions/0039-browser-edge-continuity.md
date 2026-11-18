# ADR-0039: DER Browser Edge (DBE) — service continuity when the DER server is off

- Status: PROPOSED
- Date: 2026-11-18
- Deciders: socaya
- Related: ADR-0004 (hybrid edge emulation), ADR-0038 (DPP/1), P2P.1–P2P.8, DPP.1–DPP.4

## Context

Today the DER server is the single trust anchor. Every client app —
DER-native (Data Entry, Capture, Peers) and DHIS2 custom
(Dashboard, Data Visualizer, Maps, eRegisters) — holds open a
dependency on `http://<edge>/api/*` + `/edge-api/*`. If the DER
server is off, **the clients stop working** in three ways
simultaneously:

| What breaks | Why |
|---|---|
| App shells don't load | Browser can't fetch the HTML/JS bundles |
| Bundles that are loaded crash | Every `/api/me`, `/api/metadata`, `/api/analytics` probe 502s |
| DPP mesh can't form new sessions | WebRTC signaling broker lives on the server |
| Journal writes can't drain to central | HTTP pipe closed |

**The user's question stated plainly:** if the DER server dies, the
apps fail. Is there anything we can do?

**Honest answer: yes, but not all of it.** Some things genuinely
require the server (central sync, authoritative journal, device
approval). Others don't — once the browser has the bundle + the
metadata + the local state, it can continue a lot on its own.
And an already-established DPP mesh session doesn't need the
signaling broker to stay alive — WebRTC is peer-to-peer after
handshake.

## Decision

Define **DBE — DER Browser Edge**: a client-side layer that makes
every DER browser self-sufficient for a defined service-continuity
envelope. When the DER server is reachable, DBE is transparent and
the current behaviour holds exactly. When the DER server stops
answering, DBE picks up a scoped set of responsibilities so clinic
operations don't collapse.

### What DBE covers

| Capability | Server down → DBE does |
|---|---|
| **App shell loading** | Service worker serves the pre-cached React app + every installed DHIS2 app bundle from the Cache Storage API. First visit after install primes the cache; subsequent loads are server-independent. |
| **`/api/me`** | SW returns the cached user payload from the last successful session. Read-only; attempting to change identity returns 503. |
| **`/api/metadata/**` reads** | SW intercepts → IndexedDB-backed mirror populated by the normal central-sync path (or by DPP.8 metadata sync from a peer). Every list + by-UID that worked online works offline. |
| **`/api/periods`, `/api/periodTypes`** | Deterministic generation in the SW (same logic as `RelativePeriodResolver` + `PeriodsController`). |
| **`/api/systemSettings` + `/api/configuration/*` reads** | SW returns cached values from last successful fetch + the DBE defaults map. |
| **`/api/analytics` reads** | SW runs a scaled-down JS aggregator against IndexedDB-mirrored `aggregate_data_value` rows (populated by DPP mesh pushes while online). Results are tagged `partial: true` so operators know the figure may lag central. |
| **Writes** (`POST /api/dataValueSets`, `POST /tracker/**`, step contributions) | SW routes to the existing offline queue (`der-offline-v1.queue`). Drain fires on both DER-server recovery AND next successful DPP mesh session (journal replicator pushes queued writes to a connected peer whose own server IS up). |
| **DPP mesh** | Already-established sessions survive server death (WebRTC data channel is peer-to-peer). New sessions require signaling, which fails — see "peer-as-signaling" below for a mitigation. |
| **Workflow run baton** | Continues over the mesh when the SSE event stream dies — a client-side observer fires `workflow.run-advance` frames directly from local queue flushes instead of from the server-side `contribution.completed` event. |

### What DBE explicitly does NOT cover

Clear is kinder than optimistic:

| Capability | Why DBE can't cover it |
|---|---|
| Device approval / enrollment | Requires server-side identity trust anchor. New devices must wait for recovery. |
| Central metadata pull | By definition requires the server pulling from DHIS2 central. DPP metadata sync (P2P.8) lets peers share the last good snapshot, but a snapshot older than the real one on central is what you get. |
| Authoritative journal | Clients queue writes; the canonical journal is server-side. Nothing resolves conflicts in DBE — they land in the inbox when the server returns. |
| New WebRTC sessions across the room | Without the signaling broker, two devices that haven't handshake yet can't find each other. Mitigation: peer-as-signaling (below). |
| Admin surfaces (`/admin/*`) | Not a clinic-operations target; shows an "edge offline" page. |

### Architecture

Four composable layers on the client, stacked bottom-up:

```
  ┌───────────────────────────────────────────────────────┐
  │ L4  Continuity UI banner + diagnostics                │  (Peers screen + topbar chip)
  ├───────────────────────────────────────────────────────┤
  │ L3  Workflow + journal continuation                   │  (DPP mesh continues; local queue flushes to peers)
  ├───────────────────────────────────────────────────────┤
  │ L2  Browser-side DHIS2 API emulator                   │  (SW intercepts /api/*; IndexedDB-backed)
  ├───────────────────────────────────────────────────────┤
  │ L1  Shell + bundle caching (PWA)                      │  (Workbox cache-first for shells; versioned)
  └───────────────────────────────────────────────────────┘
```

Each layer is independently valuable — if we ship L1 first, bundle
reload works even when server is down; L2 adds read-side continuity
on top; L3 adds write-side via mesh; L4 is operator transparency.

#### L1 — shell + bundle caching

- Workbox strategy: `CacheFirst` for `/dhis-web-<key>/**` + the DER
  SPA bundle (`index.html`, `assets/**`). Network updates cache in
  the background (`StaleWhileRevalidate` for `assets/**` so
  hot-fixes propagate without the operator reloading).
- Pre-cache every installed app's manifest + core files at install
  time via the existing `AppInstaller` pipeline.
- Version by DER build id — on new version install, old caches are
  evicted via `cleanupOutdatedCaches` so stale shells don't linger.

Scope: ~2 weeks engineering. No new server code.

#### L2 — browser-side DHIS2 API emulator

- Extend the existing SW to intercept `/api/**`.
- IndexedDB schema: `der-dbe-v1` with stores `metadata`, `settings`,
  `periods`, `queue`, `analytics_snapshots`. Keyed to mirror DER's
  server-side schema so data shape round-trips cleanly.
- Hydrate on successful fetch: every GET that returns 200 writes the
  response body into the matching store. Over normal use, the cache
  fills up naturally; no explicit prefetch step.
- On failed fetch (`fetch.ok === false` OR `TypeError: NetworkError`
  OR `503`), SW falls back to IndexedDB. Returns 200 with the cached
  body + a `X-DER-From-DBE: 1` header so UI can display "showing
  cached data" when useful.
- Writes: POST/PUT/DELETE lands in the queue store; a 202 Accepted
  is returned to the caller with the queue id; UI continues as if
  the write succeeded. Journal replicator (DPP.4) picks up from the
  same queue when a mesh session opens.

Scope: ~4 weeks. Most complex layer. Risk: analytics aggregation in
the browser is single-threaded JS vs server-side columnar query —
numbers may lag for large datasets. We mitigate by deferring
analytics evaluation to a Web Worker and tagging results `partial:
true` when the local mirror is older than 24h.

#### L3 — workflow + journal continuation over mesh

- Everything in DPP.1–DPP.4 already works once a session is
  established. The gap is the handshake: new sessions need
  signaling, which lives on the DER server.
- **Peer-as-signaling (P-sig)**: when the DER server is
  unreachable, one device in an existing mesh that previously
  received approved-device info can act as the signaling broker.
  Protocol:
  1. DPP/1 gains a new resource `control`, action `signal-relay`.
  2. A device wanting to open a session to Alice sends
     `signal-relay` with its SDP offer to any connected peer that
     has an active session with Alice.
  3. That peer forwards the offer to Alice via the existing
     channel; Alice replies with an answer; same path reversed.
  4. ICE candidates shuttle the same way.
- P-sig is only trustworthy between already-APPROVED devices — the
  usual server-side approval check is bypassed, so devices that
  weren't approved before the server went down CAN'T join the mesh.
  Keeps the trust envelope sealed.

Scope: ~2 weeks. Extends DPP/1 one resource; UI shows "signaling
via peer <X>" when a session is opened this way.

#### L4 — continuity UI

- Topbar chip: green dot (server + mesh healthy), amber (server
  degraded / DBE active), red (server down and no DBE coverage for
  the current screen).
- `/peers` screen gains a "Continuity" card showing: DER server
  reachability, local cache hit rate, queued writes count,
  peer-as-signaling status.
- Server-recovery banner: when the server comes back, prompt to
  drain the local queue + reconcile with the authoritative journal
  (one click, operator confirms).

Scope: ~1 week.

### Rollout

Four phases, each ships independently:

| Phase | Deliverable | Weeks |
|---|---|---|
| **DBE.1** | L1 — Workbox CacheFirst for app shell + DHIS2 bundles | 2 |
| **DBE.2** | L2 — SW `/api/**` interceptor + IndexedDB read-mirror | 4 |
| **DBE.3** | L3 — peer-as-signaling + mesh-first fallback | 2 |
| **DBE.4** | L4 — continuity UI + server-recovery drain prompt | 1 |

Total: ~9 weeks for the full envelope. Clinic operators see value
from day one of each phase — phases are not sequentially
prerequisites, just stacking value.

### Why not just "require DER server to be highly available"

Considered and rejected. DER's whole premise is edge-resilient
clinics on flaky power + flaky LAN + flaky WAN. A "server must be
up" story contradicts the product thesis. DBE is the honest
engineering response to the deployment reality.

## Consequences

**Positive:**
- Clinic workflow survives DER server outages for the defined
  envelope (reads, writes, workflow baton, metadata).
- Service continuity scales with mesh size — a 3-device clinic that
  loses the server but keeps the mesh continues operating.
- Writes are never lost. Queue persists in IndexedDB; drains to
  either the recovered server or a mesh peer with a live server.

**Negative:**
- Analytics numbers may lag reality by the local-mirror age when
  DBE is serving them; UI must make this visible.
- Cache invalidation is a real concern — stale metadata on a
  clinic tablet could mean a nurse enters a decommissioned data
  element. Mitigated by versioned pre-cache + `X-DER-From-DBE`
  header so UI can prompt re-sync.
- IndexedDB quota varies by browser + site storage pressure —
  degraded mode when quota exceeded (operator banner, no writes
  accepted until drain).
- Peer-as-signaling expands the trust surface — a compromised
  APPROVED device could proxy for an attacker. Mitigated by only
  trusting P-sig forwards between devices that were already
  APPROVED in the last-known trust table.

**Neutral:**
- DBE adds ~150kb to the SW bundle (gzipped). Acceptable for the
  guarantee it provides.

## Open questions

- Should L2 ship a full JS analytics engine (parity with the server
  `/api/analytics`) or a read-only pivot over a cached response?
  Proposal: ship pivot-over-cached-response in DBE.2; defer the
  full engine until pilot data says we need it.
- Does L3 need a dedicated peer-as-signaling capability on HELLO,
  or can it piggy-back on the existing `control` resource?
  Proposal: dedicated action `control.signal-relay` for clarity.
- How long is a cached `/api/me` payload trusted when the server is
  down? Proposal: 24h ceiling — after that, operators must re-sign
  in when server recovers.

## Reference implementation seeds

Nothing landed yet. If this ADR is accepted, the implementation
plan above sets the four-phase order. P2P.1–P2P.8 + DPP.1–DPP.4
already provide everything DBE.3 needs; DBE.1 + DBE.2 are the
heavier lifts.
