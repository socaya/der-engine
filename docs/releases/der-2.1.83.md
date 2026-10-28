# der-2.1.83 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.82`

## Headline

**`/sync/settings` fully modernised.** The old def-list of
URL / version / status chip is replaced with a live-pulse
connection card, a 60-bar reliability sparkline, and
cross-links into the surrounding sync machinery.

## Layout

```
Sync Settings · ● Connected                [✎ Open DHIS2 configuration] [↻ Probe now]
Central DHIS2 connection + sync behaviour for this edge.
· 100% uptime over last 100 probes

┌──────────────────────────────────────────────────────────────────────────────┐
│   ●       DHIS2 Central is online                                            │
│   ((•))   Reached in 109 ms · live-probing every 15 s                        │
│  (( ● ))                                                                     │
│   ((•))   URL              Central version   Pinned           Profile        │
│    ●      http://localhost 2.44-SNAPSHOT     2.44-SNAPSHOT    V2_44          │
│           Auth             Last probe                                        │
│           Basic            10/28/2026, 8:46:59 PM                            │
└──────────────────────────────────────────────────────────────────────────────┘

Reliability — last 100 probes            100 succeeded · 0 failed · 100% uptime
▁▂▁▁▂▁▁▂▁▁▁▂▁▁▂▁▁▁▂▁▂▁▁▁▂▁▁▁▂▁▁▁▂▁▁▂▁▁▁▂▁▁▂▁▁▁▂▁▁▁▂▁▁▁▂▁▁▂▁▂▁▁▁

Sync behaviour
Batch size, retry delay, back-off and request timeout are managed via scheduler cron expressions.
[○ Open Schedule]  [≡ Open fine-grained Settings]  [⟲ Open Sync history]
```

## Live pulse graphic (`.ea-dhis2-conn-pulse`)

### Online (`--on`)

- 36 px green core with a halo (`box-shadow: 0 0 0 6px rgba(17,122,68,0.14)`).
- Three concentric rings animate outward with staggered 0 s / 0.8 s / 1.6 s delays:

```css
@keyframes ea-pulse-ring {
  0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.6 }
  70%  { opacity: 0 }
  100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0 }
}
```

Visually reads as a steady "there's a heartbeat" pulse — one
ring expanding at a time, two more following, total cycle 2.4 s.

### Offline (`--off`)

- Grey core (`var(--der-ink-300)`).
- Rings removed.
- 60 px warning-ink diagonal slash across the core — the universal
  "disconnected" glyph.

Signal is instantly readable from across the room even without the
"DHIS2 Central is online / unreachable" headline next to it.

## Live reachability signal

The page keys off the `useCentralReachable` hook introduced in
2.1.67 — polls `/edge-api/v1/dhis2/ping` every 15 s with a 10 s
server-side cache. So the pulse graphic flips from on → off
within one poll cycle when Central drops, and back within one
poll cycle when it returns. Falls back to the compat snapshot
on first paint while the first ping is in flight.

## Reliability sparkline

- Up to 60 bars from `compatHistory(100).snapshots.slice(0, 60)`,
  reversed so newest sits on the right.
- Bar height scaled from the probe RTT (clamped between 6 px
  and ~84 px via `min-height` + container height).
- Green bars for successful probes, red for failures.
- Each bar carries a `title=` with `OK / Fail · {rtt} ms · {timestamp}`.

Reliability summary ("N succeeded · M failed · P% uptime") sits
on the right of the panel title.

## Cross-links

Three subtle cross-links at the bottom cover the surrounding
sync machinery — not duplicating the page's job, just making
the next step obvious:

- **Open Schedule** → `/sync/schedule` (where cron expressions live)
- **Open fine-grained Settings** → `/settings` (feature flags etc.)
- **Open Sync history** → `/sync/history` (the full run log)

Each is an `.ea-btn.ea-btn--ghost.ea-btn--sm` with a `UiIcon`
prefix matching the destination page's section-tab glyph.

## Removed

- The "Test connection" button that used to live inside a
  Panel — the "Probe now" header action replaces it (same
  behaviour, better placement).
- The read-only "Connection status / Authentication" def-list
  rows — captured by the pulse graphic + headline + facts grid
  more compactly.

## Live assertions

```
headline               : "DHIS2 Central is online"
.ea-dhis2-conn-pulse--on : present
.ea-dhis2-conn-pulse--off : absent
sparkline bars         : 60
first bar dimensions   : 25 × 13 px
```

Screenshot: `/tmp/der-2.1.83b-settings.png`.

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.83 JAR built
Server serves 2.1.83           ✓
Playwright live-pulse check    ✓
```
