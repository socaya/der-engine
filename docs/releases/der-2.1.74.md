# der-2.1.74 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.73`

## Headline

Wherever the UI still built a `.ea-chip ea-chip--*` from code
to show a status/outcome, it now goes through `<Status tone>`.
Visually identical to the quiet markers already shipped (same
"● label" tone-coloured text), but the call-sites now use the
canonical component so future tone-mapping lives in one place.

## Converted call-sites

| File | What | Was | Now |
|---|---|---|---|
| `SyncHistory.tsx` detail panel | Outcome status row | `.ea-chip--success/danger/info` | `<Status>` |
| `DataQueues.tsx` detail panel | Operator state row | `.ea-chip--*(operatorStateTone)` | `<Status>` |
| `DataQueues.tsx` detail panel | Parsed response status | `.ea-chip--success/danger` | `<Status>` |
| `SyncOverview.tsx` ProgressRow | Pull-metadata / push-data progress chip | `.ea-chip--success/danger/warning/info` | `<Status>` |
| `DataQueues.tsx` push progress | Same shape | `.ea-chip--...` | `<Status>` |
| `CapabilityScreens.tsx` metadata-sync progress | Same shape | `.ea-chip--...` | `<Status>` |
| `CapabilityScreens.tsx` OU binding header | "bound" + "Level N" | `.ea-chip--success / --info` | `<Status>` |
| `EACoreScreens.tsx` sync-jobs outcome | `outcomeChipCls()` string factory | returned class names | new `outcomeTone()` returns `StatusTone` enum, consumed by `<Status>` |

## Why the churn

Before this release, `<Status tone>` was already the canonical
quiet marker, but a handful of call sites still built the chip
tone string inline. Those two patterns rendered the same (thanks
to the 2.1.65 flat-chip CSS), but code searches like "where do
we show the outcome of a sync run?" would miss the inline
builds. Centralising on `<Status>` closes that gap.

## No visual change in-browser

Because `.ea-chip` and `.ea-status` already render identically
(transparent background, tone-coloured dot + text), nothing
looks different today. The payoff is maintainability — one
component to update if the tone mapping ever changes again.

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.74 JAR built
Server serves 2.1.74           ✓
```
