# ADR-0040: DBE storage guarantees — IndexedDB + persistent grant

- Status: ACCEPTED
- Date: 2026-11-18
- Deciders: socaya
- Related: ADR-0039 (DBE service continuity), ADR-0019 (device management)

## Context

ADR-0039 defined DER Browser Edge (DBE) — the client-side layer that
keeps clinic apps working when the DER server is unreachable. DBE is
only useful if its local storage **actually survives** the real-world
events a clinic tablet goes through:

- Browser tab closed, device shut down, battery dies
- Operator taps "Clear browsing data" / "Clear cache" in the browser
- Chrome / Safari aggressively evicts under storage pressure
- Multiple tabs of the same site racing to write the same records
- App update from one DER release to the next (service worker
  upgrade path)

The user's framing: "closing a browser and clearing browser cache
MUST not delete the local client data." That requirement rules out
several browser storage mechanisms outright and pins us to one
specific pattern that browsers do honor.

### Candidate storage mechanisms

| Mechanism | Survives tab close | Survives "clear cache" | Capacity | Notes |
|---|---|---|---|---|
| `sessionStorage` | ✗ | ✗ | 5–10 MB | per-tab, synchronous |
| `localStorage` | ✓ | ✗ | 5–10 MB | synchronous, strings only |
| Cookies | ✓ | ✗ (clear includes cookies) | 4 KB | sent on every request |
| `caches` (Cache Storage API) | ✓ | ✗ | GB range | SW-focused; evictable |
| **IndexedDB** | ✓ | ✗ by default, **✓ with persistent grant** | GB range | structured, async |
| **IndexedDB + `navigator.storage.persist()`** | ✓ | **✓** (browser-confirmed) | GB range | same as IDB, plus survival guarantee |
| Origin Private File System (OPFS) | ✓ | ✗ (evictable) | GB range | sandboxed, async, no user picker |
| File System Access API (showSaveFilePicker) | ✓ | ✓ (operator-controlled) | unlimited | needs picker + permission; export/backup pattern |

### The persistent storage grant

`navigator.storage.persist()` is the key primitive:

```js
if (navigator.storage && navigator.storage.persist) {
  const granted = await navigator.storage.persist();
  // granted === true means:
  //   - Browser will NOT evict our storage under pressure
  //   - "Clear browsing data" prompts the user to confirm site-by-site
  //     (Chrome, Firefox, Edge) instead of silently wiping us
  //   - Survives long tab-closed periods without eviction
}
```

Grant conditions per browser (as of 2026):

| Browser | Auto-granted when |
|---|---|
| Chrome / Edge | Site is "installed" as PWA (Add to Home Screen), OR has high engagement score (frequent re-visits), OR has push notifications permission |
| Firefox | Always prompts the user with a persistent-storage dialog |
| Safari | Tied to Add to Home Screen; PWA-installed origins get 7-day eviction ceiling without engagement, persistent after that |

For DER clinic tablets this is a solved problem: devices are
**installed as PWAs** at enrolment time (we already surface the
"Install DER" prompt via the existing manifest). Once installed,
`.persist()` auto-grants on Chrome + Edge. On Safari we prompt the
operator explicitly. On Firefox we accept the dialog outcome.

## Decision

Pin DBE storage to **IndexedDB promoted to persistent** at first app
launch. Provide an explicit fallback path for cases where the browser
denies persistence. Treat non-persistent sessions as degraded and
surface it in the UI so operators know their data may be evicted.

### Three-tier storage model

```
  ┌───────────────────────────────────────────────────────────────┐
  │ Tier 3 — Operator-controlled backup (File System Access API)   │
  │ Periodic "Save DER snapshot" button writes a signed .der-pack │
  │ to a folder the operator picked (SD card, USB stick, cloud).  │
  │ Survives EVERYTHING. User-triggered or scheduled.             │
  ├───────────────────────────────────────────────────────────────┤
  │ Tier 2 — Persistent IndexedDB (navigator.storage.persist)      │
  │ Primary runtime store. Journal queue, metadata mirror, cached │
  │ API responses, DPP route table seed. Survives tab close +     │
  │ clear-cache on persistence-granted browsers.                  │
  ├───────────────────────────────────────────────────────────────┤
  │ Tier 1 — Volatile Cache Storage                                │
  │ Service worker's shell + bundle cache. Lost on clear-cache    │
  │ but regenerated on next online visit. Not critical.           │
  └───────────────────────────────────────────────────────────────┘
```

### What lands in Tier 2 (IndexedDB)

All DBE-critical state:

| DB | Store | Purpose |
|---|---|---|
| `der-offline-v1` | `queue` | Write queue (already exists — JournalReplicator source) |
| `der-dbe-v1` | `metadata` | Mirror of `/api/metadata/*` responses |
| `der-dbe-v1` | `settings` | Cached `/api/me`, `/api/systemSettings`, `/api/configuration/*` |
| `der-dbe-v1` | `analytics_snapshots` | Cached `/api/analytics` results + aggregation input snapshots |
| `der-dbe-v1` | `p2p_routes` | Last-known DPP route table seed (peer handshake accelerator) |
| `der-dbe-v1` | `device_identity` | Approved device trust cache for P-sig fallback |

### Request flow

At app boot, before any fetch is intercepted:

```
1. Check navigator.storage.persisted() — are we already persistent?
   └─ YES → proceed, we're good.
   └─ NO  → navigator.storage.persist() — ask.
       └─ true → log + proceed.
       └─ false → surface "degraded mode" banner to operator
                  AND disable Tier 2 write-ahead for destructive
                  operations until the user acknowledges the risk.
                  Device enrollment includes a step that prompts
                  the user to "Add DER to Home Screen" — the
                  resulting PWA-install flag auto-grants on next
                  boot, closing the degraded loop.
```

### Multi-tab coordination

IndexedDB is safe to share across tabs of the same origin, but we
need to avoid lost writes when two tabs race to update the same
record:

- Use `BroadcastChannel('der-dbe')` for cross-tab notifications of
  significant write events (`metadata.synced`, `queue.drained`,
  `session.opened`).
- Writes use IndexedDB's transactional primitives — no app-level
  locking needed; the cursor-based update path IndexedDB already
  provides is per-store serialisable.

### Tier 3 — operator backup

For truly paranoid continuity (e.g. tablet hardware failure, device
loss):

- A new `/peers` screen card: "Export local DER data". Uses
  `showSaveFilePicker` to let the operator pick an SD card / USB /
  OneDrive folder.
- Export format: `.der-pack` — a signed tar.gz of the IndexedDB
  dump + the session's device_identity + the last cached metadata
  fingerprint.
- Imported on a fresh tablet to seed Tier 2 storage before coming
  online.
- Not auto-scheduled; triggered by the operator (who's responsible
  for backup discipline).

### Storage pressure handling

- `navigator.storage.estimate()` periodically polled; log and
  surface when usage > 80% of quota.
- Eviction policy on pressure (regardless of persistent grant):
  1. Drop oldest entries in `analytics_snapshots` first
  2. Drop oldest entries in `metadata` next (can re-sync from peer
     or server when they recover)
  3. NEVER drop `queue` — unsent writes are irreplaceable; refuse
     new writes with a clear error when the quota would be hit.

## Consequences

**Positive:**
- "Clear browsing data" doesn't nuke clinic state once persistence
  is granted — survives the single failure mode operators fear most.
- PWA install flow already doubles as the persistence-grant flow
  on Chrome/Edge — no extra operator step.
- Operator-controlled Tier 3 backup covers the catastrophic case
  (tablet dies, needs reseeding).

**Negative:**
- Firefox always prompts the user; UX guidance needed in the
  enrolment flow to walk them through accepting the dialog.
- Safari persistence only kicks in post-install + with engagement.
  Fresh Safari tablets in a clinic will take some time to earn
  persistent storage; we document this in the ops guide.
- IndexedDB quota varies by browser + device storage. A 32 GB
  tablet will have more quota than an 8 GB cheap tablet. The
  degraded-mode banner surfaces when quota pressure hits.

**Neutral:**
- No server change required. DBE storage is entirely client-side.
- Three-tier model composes with existing work — Tier 2 is just
  the existing `der-offline-v1.queue` plus the DBE.2 stores
  landing next.

## Open questions

- Should Tier 3 backup include the DPP handshake identity material
  (device public key)? If yes, a backed-up tablet can be re-seeded
  with the same identity and relay-received writes still verify.
  Proposal: yes — the backup is end-to-end encrypted with an
  operator-chosen passphrase so loss-of-SD doesn't leak identity.
- Operator-visible storage estimate: a card on the Peers screen or
  a chip in the topbar? Proposal: chip in the topbar, drill-in
  from `/peers` → Continuity card.

## Reference implementation seeds

- `client/src/dbe/storage.ts` — `requestPersistentStorage()`,
  `storageEstimate()`, `broadcastChannel()` helpers.
- `client/src/dbe/degradedBanner.tsx` — React banner surfaced in
  `DerShell` when persistence is denied.
- The `der-dbe-v1` IDB schema lands in DBE.2 alongside the SW
  `/api/**` interceptor.

DBE.1b (this ADR's implementation) ships the persistence request +
degraded banner; the storage schema itself lands with DBE.2.
