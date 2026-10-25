# der-2.0.27 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.26`

## Headline

Strip redundant chrome from every page: the subtitle under each
H1 and the inline OU breadcrumb bar are gone, along with a
developer-only resource-name label on the Metadata screen. The
H1 and the topbar OU chip carry the context on their own.

## Changes

### `admin-ui/src/components/HeroHeader.tsx`
- `HeroHeader` no longer renders the `<p class="ea-hero-sub">`
  subtitle paragraph. The signature keeps `subtitle` in the type
  for backwards compatibility with existing call sites, but the
  element is simply not emitted.

### `admin-ui/src/styles.css`
- `.ea-hero-sub, .ea-dash-hero-sub, .ea-ou-bar` globally
  `display:none`. Covers both the HeroHeader subtitle and the
  dashboard-hero subtitle variant used by Metadata / Workspace /
  Users / System screens.
- `.ea-ou-bar` block (previously a boxed OU breadcrumb row with
  "Organisation Unit (Single OU)" label, country > district >
  facility crumbs, and a "View OU Details" button) collapsed to
  a single `display:none`. Topbar OU chip is the single source
  of binding context.

### `admin-ui/src/screens/mockups/Metadata.tsx`
- Dropped the muted `resource dataElements` developer-tech
  label next to the mirrored-count chip. The chip (e.g.
  "358 mirrored") carries the useful information.

## Live verification (all 10 pages green)

Subtitle visible / dashboard-sub visible / OU-bar visible on:

| Page                                | hero-sub | dash-sub | ea-ou-bar |
|-------------------------------------|---------:|---------:|----------:|
| /admin/                             |        0 |        0 |         0 |
| /admin/dhis2                        |        0 |        0 |         0 |
| /admin/dhis2/connection             |        0 |        0 |         0 |
| /admin/dhis2/organisation-unit      |        0 |        0 |         0 |
| /admin/dhis2/metadata               |        0 |        0 |         0 |
| /admin/sync                         |        0 |        0 |         0 |
| /admin/sync/history                 |        0 |        0 |         0 |
| /admin/provisioning/users           |        0 |        0 |         0 |
| /admin/data/maintenance             |        0 |        0 |         0 |
| /admin/sync/queues                  |        0 |        0 |         0 |

Metadata screen: H1 = "Metadata", picker = 45 resources, no
`resource dataElements` developer label, no `A&A Medcare` text
in the hero region (topbar OU chip still shows the live
binding).

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.27/V227-metadata.png`
+ `V227-connection.png`.
