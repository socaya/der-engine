# der-2.1.46 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.45`

## Headline

Clean up the Metadata page's "Last pull" + "Metadata summary" area.
The two stacked def-list panels have been folded into a single
horizontal strip of five label-above-value cells, matching the quiet
typographic hierarchy used elsewhere in the admin UI.

## Changes

### `admin-ui/src/screens/CapabilityScreens.tsx`

- Removed both the "Last pull" and "Metadata summary" `Panel` cards
  (they were showing the same information twice and taking up ~160 px
  of vertical space each).
- New `StatCell` helper renders a label-above-value pair with the
  standard uppercase 10 px label + 13 px value sizing — no card
  background, no borders. Used elsewhere in the admin UI already for
  compact fact strips.
- Single horizontal strip now carries five cells in a responsive
  auto-fit grid (min 180 px per cell):
  - **Last pull** — formatted local timestamp
  - **Result** — Succeeded / Failed chip
  - **Duration** — humanised
  - **Triggered by** — humanised scheduler trigger
  - **DHIS2 version** — pulled from `systemInfo.dhis2.centralVersion`
- The strip sits on a `var(--der-raised)` background with a thin
  `var(--der-border-subtle)` border — same muted treatment as the
  Dashboard's fact strips.
- Information previously duplicated in the summary (last successful
  pull, Central DHIS2 reachability) already appears in the header
  subtitle, so dropping it here removes the redundancy rather than
  hiding anything.

### Visual

Before:

```
┌──────────── Last pull ────────────┐  ┌──────── Metadata summary ────────┐
│ When          10/27/…             │  │ Last successful pull  10/27/…    │
│ Result        Succeeded           │  │ Last attempt          10/27/…    │
│ Duration      5s                  │  │ DHIS2 version         2.44-…     │
│ Triggered by  Scheduled           │  │ Central DHIS2         Reachable  │
└───────────────────────────────────┘  └──────────────────────────────────┘
```

After:

```
LAST PULL              RESULT       DURATION   TRIGGERED BY   DHIS2 VERSION
10/27/2026, 12:00 PM   ✓ Succeeded  5s         Scheduled      2.44-SNAPSHOT
```

## Live assertions

Playwright-verified against the running local DER:

| Check                                          | Observed |
|------------------------------------------------|----------|
| `[data-test="metadata-last-pull"]` strip renders | ✓      |
| Strip text                                     | `LAST PULL 10/27/2026, 12:00:00 PM RESULT Succeeded DURATION 5s TRIGGERED BY Scheduled DHIS2 VERSION 2.44-SNAPSHOT` |
| "Metadata summary" panel removed               | ✓ (not in DOM) |
| Recent pulls table still present               | ✓        |

Screenshot: `/tmp/der-metadata/metadata.png`.
