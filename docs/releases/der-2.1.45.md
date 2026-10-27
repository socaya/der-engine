# der-2.1.45 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.44`

## Headline

Polish pass on the Sync module in response to:

> "I still think the UI for Sync has been messed up and not professional
> at all. Please enhance the UI properly and use standard UI components
> to ensure that they remove all hero boxes but display data and
> records in professional soft calm look."
>
> "Keep standard UI design layouts across all modules please."

Every Sync screen now uses the admin UI's standard `.ea-screen-header`
+ `.ea-chip` + `.ea-btn` primitives. No custom status cards, no accent
stripes, no shimmer bars.

## Changes

### `admin-ui/src/screens/mockups/shared.tsx`

- `SyncStatusBar` repurposed as a thin wrapper over the existing
  `.ea-screen-header` layout. Signature changed from `tone + title +
  details + actions` → `tone + title + statusLabel + subtitle +
  actions`.
  - **title** → the plain nav-level label (`Synchronisation`,
    `Metadata`, `Data`, `Worker`, `Needs your attention`)
  - **statusLabel** → rendered as a `.ea-chip` next to the H1 (`Up to
    date`, `Paused`, `Running`, `All sent`, `All clear`, `N waiting`,
    `Needs attention`)
  - **subtitle** → inline detail chips in the `.ea-screen-header-sub`
    slot, bulleted by `·` separators (standard typographic bullet
    rather than hairline rules)
  - **actions** → right-aligned button cluster in
    `.ea-screen-header-right`
- The previous `details` prop is kept as an alias of `subtitle` so no
  caller breaks mid-migration.
- Removed the loud shimmer / colored-strip progress indicator. Replaced
  with a quiet inline row: `[Spinner]` + `.ea-chip ea-chip--info/success/
  danger` state chip + action label + message + dismiss link. Uses only
  tokens from the design system.
- Dropped the unused `TONE_ACCENT` map and `der-prog` keyframes.

### Screen-level cleanups

| Screen | Title + chip |
|--------|--------------|
| `/sync` | `Synchronisation` + status chip (`Up to date` / `Paused` / `Central unavailable` / `Needs attention` / `N waiting`) |
| `/sync/metadata` | `Metadata` + chip (`Up to date` / `Never pulled` / `Last pull failed`) |
| `/sync/data` | `Data` + chip (`All sent` / `N waiting` / `N need attention` / `Paused` / `Central unavailable`) |
| `/sync/attention` | `Needs your attention` + chip (`All clear` / `N items`) |
| `/sync/worker` | `Worker` + chip (`Running` / `Paused`) |

- Overview buttons stay on the header's right slot. Both actions use
  `.ea-btn--sm` sizing — Pull as ghost, Push as primary.
- All subtitle metadata now reads as prose with `·` separators:
  *"Last successful sync 24s ago · Central DHIS2 reachable · 3 need
  attention"*. No large labels in bold followed by colons.
- Metadata page header no longer repeats itself (`Metadata is up to
  date` → chip said `Up to date` → read as *Metadata is up to date Up
  to date*). Title is just `Metadata`; status lives on the chip.

### Progress feedback

Clicking Pull / Push on either Overview, Metadata or Data now shows:

```
[◐ spinner] [chip: Running] Pull metadata     Running…
```

and resolves to:

```
[chip: Completed] Pull metadata     Completed · 24 updates    Dismiss
```

No shimmer bars, no colored side-strips, no boxed card. Just the chip
+ bold action name + message + dismiss link.

## Live assertions (all green)

Playwright swept all 5 Sync screens with the new structure checks:

| Route | H1 reads | Status chip | Standard header |
|-------|----------|-------------|-----------------|
| `/sync` | `Synchronisation Up to date` | ✓ | `.ea-screen-header` present |
| `/sync/metadata` | `Metadata Up to date` | ✓ | ✓ |
| `/sync/data` | `Data All sent` | ✓ | ✓ |
| `/sync/attention` | `Needs your attention All clear` | ✓ | ✓ |
| `/sync/worker` | `Worker Running` | ✓ | ✓ |

Every screen: no `.ea-dash-hero`, no `borderLeft: 4px solid`, no
inline colored strips. Everything renders through
`.ea-screen-header`, `.ea-chip`, `.ea-btn` tokens.

Screenshots: `/tmp/der-sync-polish/` (8 pages).

## Next

The Sync module is now consistent with the house style. The same
`SyncStatusBar` + `.ea-screen-header` pattern will anchor the Workflows
module rework in der-2.1.46.
