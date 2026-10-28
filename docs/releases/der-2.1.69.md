# der-2.1.69 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.68`

## Headline

Two UI polish wins from the continued review pass:

1. **`/dhis2` overview — stat strip removed.** The user-reported
   top-of-page card row ("Reachable yes / Central version 2.44 /
   Profile V2_44 / Probe RTT 882 ms / Auth Basic / Last probe …")
   is gone. Facts move inline into the standard `SyncStatusBar`
   subtitle, matching every other DER screen header.
2. **Metadata page — domain Section Tabs.** The flat 42-item
   `<optgroup>` resource picker now sits behind seven horizontal
   section tabs, one per §14.1 domain, with per-domain mirrored
   counts.

## 1. `/dhis2` overview — SyncStatusBar replaces stat strip

### Before

```
DHIS2                                   [Probe now] [Save connection]
┌──────────┬──────────────┬──────────┬──────────┬───────┬────────────┐
│Reachable │Central       │Profile   │Probe RTT │Auth   │Last probe  │
│  yes     │2.44-SNAPSHOT │V2_44     │882 ms    │Basic  │38m ago     │
└──────────┴──────────────┴──────────┴──────────┴───────┴────────────┘
```

### After

```
DHIS2 · ● Central reachable                  [↻ Probe now] [Save]
Central 2.44-SNAPSHOT · Profile V2_44 · RTT 882 ms · Auth Basic ·
   Last probe 38m ago
```

- Replaces `ea-dash-hero` + `ea-stat-strip` with `SyncStatusBar`.
- Tone-coloured "● Central reachable / unreachable" status
  marker instead of a filled chip.
- Buttons picked up the standard icon pattern (`↻` for Probe
  now; Save keeps its text-only treatment).
- Removes the local `Stat` helper and unused `ReactNode` import.

### Playwright

```
dhis2 overview old shells count
  (.ea-kpi-grid + .ea-stat-strip + .ea-dash-hero): 0
```

## 2. Metadata page — domain Section Tabs

### Before

One wide `<select>` with `<optgroup>` labels (Aggregate / Tracker
/ Rules & Validation / Organisation / Options / Analytics /
Administration). Operators had to scroll through 42 options to
find the one they wanted; the `<optgroup>` label was non-clickable.

### After

Seven horizontal section tabs at the top of the page. Each shows
the aggregate mirrored count for that domain:

```
Aggregate (361)  ·  Tracker (179)  ·  Rules & Validation (1,179)  ·
Organisation (518)  ·  Options (87)  ·  Analytics (193)  ·  Administration / Other (24)
```

Clicking a tab:

1. Highlights the active domain in the Section Tabs strip.
2. Filters the resource `<select>` dropdown to just that
   domain's resources (so Tracker shows 7 options, not 42).
3. If the currently-selected resource isn't in the new domain,
   snaps the picker to the first resource in the newly-active
   domain.

The resource picker, "mirrored count" chip, search box, and
table all behave as before — the change is purely navigational:
operators scan ~7 top-level domains instead of a 42-item flat
list.

### Playwright

```
metadata domain tabs:
  ["Aggregate(361)", "Tracker(179)", "Rules & Validation(1,179)",
   "Organisation(518)", "Options(87)", "Analytics(193)",
   "Administration / Other(24)"]

click metadata-domain-tracker:
  resource options filter to:
    ["Programs — 31", "Program stages — 76",
     "Program stage sections — 0", "Program notifications — 1",
     "Tracked entity types — 1", "Tracked entity attributes — 54",
     "Relationships — 16"]
```

Screenshot: `/tmp/der-2.1.69-metadata.png`.

## 3. Metadata details — Raw JSON pane now full-height

`.ea-log-tail` had a hard-coded `max-height: 420px` which capped
the Raw JSON diagnostic tab on
`/admin/dhis2/metadata/:resource/:id`. The pane now sizes to the
remaining viewport height:

```tsx
<pre className="ea-log-tail" style={{
  height: 'calc(100vh - 320px)',
  minHeight: 320,
  maxHeight: 'none',
}}>
```

Playwright on a 1440×900 viewport:

```
before fix: height 420 px   (bottom 811 of 900 vh — ~89 px wasted)
after fix:  height 580 px   (bottom 971 of 900 vh — fills screen,
                             internal scrollbar for overflow)
```

So the Raw JSON diagnostic view now covers the full available
space between the tab strip and the viewport bottom, with
internal scroll for very large payloads.

