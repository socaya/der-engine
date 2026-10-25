# der-2.0.35 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.34`

## Headline

Compat screen cleanup: the "Supported DHIS2 version matrix"
drops its 4-card vertical stack for a compact 7-column table,
and the "Live profile capabilities" panel stops rendering
arrays as a run-on string and objects as `[object Object]`.

## Changes

### `admin-ui/src/screens/mockups/CompatMatrix.tsx`

**Supported DHIS2 version matrix → compact table**

Replaced the `.ea-matrix` / `.ea-matrix-card` card layout with
a dense table carrying the dimensions operators actually
compare across versions:

| DHIS2 | Profile | Status            | Tracker API                        | Audit surface            | Metadata bulk | Program rules                      |
|-------|---------|-------------------|------------------------------------|--------------------------|---------------|------------------------------------|
| 2.41  | V2_41   | Minimum supported | Legacy primary · modern secondary  | /api/audits              | DHIS2_2_41    | Supported                          |
| 2.42  | V2_42   | Supported         | Legacy + modern (both active)      | /api/audits              | DHIS2_2_41    | Bulk endpoint stabilised           |
| 2.43  | V2_43   | Supported         | Modern primary · legacy deprecating| /api/audits + changeLogs | DHIS2_2_43    | Supported                          |
| 2.44  | V2_44   | Maximum tested    | Modern only — legacy REMOVED       | changeLog API only       | DHIS2_2_44    | Full endpoint + categoryOptionCombos |

The row matching the probe's resolved profile is highlighted
(`ea-row--active`) and tagged with a `live` chip in the version
column, so operators see the current environment at a glance
without hunting through long bullet lists.

**Live profile capabilities → sensible renderers**

The capabilities-table body swapped the always-call-`String(v)`
rendering for a `renderCapability` helper plus humanized key
labels:

- Array values (`supportedPeriodTypes`, `supportedProgramTypes`)
  now render as a wrap-flow of individual `.ea-chip` elements
  with proper spacing — previously they came out as a run-on
  string (`YEARLYQUARTERLYMONTHLY…`) because the chips had no
  flex wrapper.
- Object values (`endpointPolicies`) now render as a formatted
  JSON `<pre>` block — previously they stringified to
  `[object Object]`.
- Booleans still show as `yes` / `no` chips with success / muted
  tones.
- Null / undefined render as a muted `—` instead of the string
  `"undefined"`.
- Keys are humanized: `supportsCategoryOptionCombosEndpoint` →
  `Supports Category Option Combos Endpoint`, with the raw
  camelCase key kept in a small muted mono line below as the
  source-of-truth identifier.

## Live assertions

| Check                                    | Observed                               |
|------------------------------------------|----------------------------------------|
| Matrix is now a `<table>`                | yes                                    |
| Matrix row count                         | 4 (2.41, 2.42, 2.43, 2.44)             |
| Active-row highlight                     | `matrix-row-V2_44` on the current probe |
| Matrix column headers                    | DHIS2 · PROFILE · STATUS · TRACKER API · AUDIT SURFACE · METADATA BULK · PROGRAM RULES |
| `[object Object]` present anywhere       | **no** (removed)                       |
| JSON `<pre>` block in capabilities       | yes (for `endpointPolicies`)           |
| Capabilities rows                        | 12                                     |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.34/V234C-matrix.png`.
