# Admin-UI standardization punch-list

**Baseline:** 2026-11-14 after Phase 3 bulk pass (`9f86f194`).

Tracks the remaining inline-styling long tail across admin-ui screens so
follow-up sessions can target specific files. All items are safe to
address independently; none block a release.

## Heavy inline-style screens (candidates for focused per-screen passes)

| Lines | Screen | Dominant patterns |
|---:|---|---|
| 201 | `CapabilityScreens.tsx` | column widths, per-cell typography, badge styling |
| 137 | `Network.tsx` | the 2081-line network ops screen; many bespoke table layouts |
| 77 | `RelationshipDiagnostics.tsx` | SVG canvas offsets + per-cell widths |
| 56 | `SyncHistory.tsx` | result-pill colouring (migrate to `.ea-health-pill--*`) |
| 53 | `shared.tsx` | reusable `Panel` / `Status` helpers; worth normalising first |
| 42 | `DataTracker.tsx` | tracker-detail table widths |
| 39 | `DeviceMessaging.tsx` | message-list typography |
| 39 | `DataEvents.tsx` | event-list table |
| 38 | `DataAggregate.tsx` | aggregate table micro-tweaks |
| 37 | `DataQueues.tsx` | queue-list layout |
| 36 | `DataTeiDetail.tsx` | TEI detail layout |
| 36 | `AppCatalogue.tsx` | app-tile layout (plausibly a `.ea-app-tile` primitive) |

Everything below ~30 is low priority; the pattern there is almost
entirely table column widths + one-off icon alignment that is awkward
to extract.

## Repeated inline-style patterns across the tree

| Count | Pattern | Suggested primitive |
|---:|---|---|
| 168 | `fontSize: 12` | `var(--fs-xs)` or `.ea-text-xs` utility |
| 87 | `fontSize: 11` | sub-token (no matching `--fs-*`); leave or introduce `--fs-2xs` |
| 53 | `textAlign: 'right'` | `.ea-text-right` (added in `9f86f194`) |
| 50 | `fontWeight: 500` | `.ea-fw-medium` utility |
| 36 | `margin: 0` | usually on `<p>` inside a panel; consider `.ea-panel-body > p { margin: 0 }` |
| 33 | `margin: 0, padding: 10` | panel inner-content pattern |
| 29 | `padding: '8px 10px'` | cell/button padding |
| 53 total | column widths (`width: 48 / 80 / 90 / 110 / 140`) | legitimate inline; not worth extracting |

## Not worth extracting

- One-off `color: var(--der-ink-500)` on a specific label (4 screens)
- `aria-hidden` icon cells that need text-center + muted colour
- Column widths — table-layout concern, inline is correct

## How to pick up

1. Sort the heavy screens by whichever one you're about to edit next.
2. For each, apply the Phase 3 approach: extract shared blocks into
   named classes (prefix `.ea-<screen>-*`), then drop the inline styles.
3. Run `npm run typecheck && npm test` after each file.
4. Commit per screen or per logical cluster.
