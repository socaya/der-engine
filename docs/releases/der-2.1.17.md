# der-2.1.17 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.16`

## Headline

Modernise `/sync/drift` to match the Sync hub style: flat
hero + chip + action, 6-stat strip, directional lane (Metadata
is Central → DER one-way), tone-coded delta columns in the
per-entity table + pager, and a Related-tiles grid so operators
can drill from the drift reading into the mirror / sync / history.

## Changes

### `admin-ui/src/screens/mockups/MoreScreens.tsx` — `MockupDriftInspector`

- **Hero**: flat `ea-dash-hero`, H1 `Metadata drift`, inline
  `In sync` / `Drift detected` chip (`data-test="drift-status-chip"`)
  + `Recompute drift` primary action (`data-test="drift-refresh"`).
- **Stat strip** replaces the previous 4 KPI cards with
  **Status · Added · Removed · Modified · Entities · Snapshot to**.
  Each stat picks a tone from the live counts (`added > 0` → info,
  `removed > 0` → danger, `modified > 0` → warning, `0` → muted).
- **Directional lane** (`data-test="drift-direction"`): compact
  `Central → DER` row + "Metadata mirror fidelity · one-way
  comparison" title + rationale paragraph + `one-way` chip. Uses
  the same `max-content 1fr max-content` grid pattern as the hub
  so the arrow row never overlaps the detail text.
- **Fingerprints panel** unchanged — Mirror / `=` / Central
  side-by-side.
- **Per-entity breakdown** now has a **Net** column, tone-coded
  `Added` / `Removed` / `Modified` cells (success-ink / danger-ink
  / warning-ink only when non-zero), a count caption in the panel
  head (`N deltas`), and a `TablePager` so instances with lots
  of entity kinds are reachable instead of being clipped.
- **Related tiles** at the bottom (`data-test="drift-related"`):
  Metadata browser · Metadata sync · Sync history — each with
  live-tailored captions explaining the drill-in context.

### Supporting edits

- Local `Stat` helper added alongside the drift hub so the strip
  takes a consistent tone/value shape with the Sync hub + Compat
  matrix.
- Dropped the dead `IconChange` SVG helper that only the old
  "Changed entities" KPI tile referenced.
- `MoreScreens.tsx` now imports `ReactNode` from `react` for the
  new local `Stat`.

## Live assertions (all green)

| Check                                      | Observed                                                        |
|--------------------------------------------|-----------------------------------------------------------------|
| Hero title                                 | `Metadata drift`                                                |
| Status chip                                | `In sync` (success tone) on this instance                       |
| Primary action                             | `Recompute drift`                                               |
| Stat labels                                | status · added · removed · modified · entities · snapshot to    |
| Directional lane text                      | contains `Central → DER`, `Metadata mirror fidelity`, `one-way` |
| Related tiles                              | Metadata browser · Metadata sync · Sync history                 |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.17/V2117-drift.png`.
