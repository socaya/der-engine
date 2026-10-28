# der-2.1.77 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.76`

## Headline

Two compactness wins:

1. **Metadata health panel removed from `/dhis2/metadata`.** The
   4-up grid ("Last sync / Central snapshot / Edge snapshot /
   Drift") is gone. Same facts fold inline into the standard
   screen-header subtitle, saving ~140 px of vertical space on
   the resource browser.
2. **Topbar OU chip de-pilled.** The soft-background pill with
   a navy `OU` badge is replaced with quiet tone-coloured text
   matching every other DER status marker.

## 1. Metadata page — health panel out, inline facts in

### Before

```
Metadata                           [Pull metadata] [Drift]
Read-only mirror of every DHIS2 metadata resource on this edge.
2,541 items across 45 resources.

┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Metadata health                                                       │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Last sync       │ Central snapshot│ Edge snapshot   │ Drift           │
│ ● Never synced  │ 30              │ 29              │ ● Unknown       │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘

[7 domain tabs]
```

### After

```
Metadata                                [↓ Metadata sync] [⇋ Drift]
Read-only mirror · 2,541 items across 45 resources ·
   Never synced · Snapshot 30→29 · Unknown
[7 domain tabs]
```

- Four facts (last sync, central snapshot, edge snapshot, drift
  status) now sit on the subtitle line next to the hero copy.
- Tone-coloured text preserves the signal — the "Never synced"
  phrase renders in warning-ink, "Unknown" in muted ink, etc.
- The soft-outlined `.ea-panel` card is gone — ~140 px of
  vertical space returned to the metadata table.

`.ea-panel[data-test="metadata-health"]` is now **absent** on
`/dhis2/metadata` (Playwright confirms). The screen-header
instead carries `data-test="metadata-health"` so tests that
previously targeted the panel can still find the summary values.

Unused `HealthField` component + `HealthTone` type removed from
`Metadata.tsx`.

## 2. Topbar OU chip — quiet marker

### Before

```
┌──────────────┐
│ OU  Clinic X │   ← navy "OU" badge, pill border, raised background
└──────────────┘

┌─────────────┐
│ OU  Unbound │   ← warning-soft background + warning-ink text
└─────────────┘
```

### After

```
OU  Clinic X                        ← tone-ink text only
OU  Unbound                         ← warning-ink text only
```

CSS collapsed:

- `background: var(--der-raised)` → `transparent`
- `border: 1px solid var(--der-border-subtle)` → `0`
- `border-radius: var(--r-pill)` → `0`
- `OU` badge: navy background + white text → muted uppercase label

Matches the 2.1.65 "no chip pills on module pages" direction and
the 2.1.67 quiet topbar operating-mode marker.

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.77 JAR built
Playwright metadata page
  health panel present        : false (removed)
  header carries facts        : "Read-only mirror · 2,541 items across
                                 45 resources · Never synced ·
                                 Snapshot 30→29 · Unknown"
```
