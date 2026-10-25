# der-2.0.23 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.22`

## Headline

DHIS2 sub-nav cleanup. `Metadata drift` and `Metadata sync` drop
out of the DHIS2 tab strip now that the Metadata screen surfaces
them as hero actions — the two paths are no longer duplicated in
both the sub-nav and the screen. Routes stay alive so direct
links and the hero buttons both continue to work.

## Changes

### Navigation (`admin-ui/src/app/navigation.ts`)
- `drift` → `status: 'contextual'`
- `metadata-sync` → `status: 'contextual'`

Contextual routes are kept out of the sidebar and sub-nav tabs
but remain registered in `App.tsx` and reachable through
contextual actions — exactly the pattern already used for
`Add user`.

### DHIS2 sub-nav before/after

| Before (2.0.22) | After (2.0.23) |
|---|---|
| Overview · Connection · Organisation unit · Compatibility · Metadata · **Metadata drift · Metadata sync** | Overview · Connection · Organisation unit · Compatibility · Metadata |

## DHIS2 group audit vs `docs/ui/02-screen-inventory.md`

| Spec screen             | Route / surface                              | Status                        |
|-------------------------|----------------------------------------------|-------------------------------|
| EA-03 Central endpoint  | `/dhis2/connection`                          | present                       |
| EA-04 Organisation scope| `/dhis2/organisation-unit`                   | present                       |
| EA-05 Metadata bootstrap| `/dhis2/metadata-sync` (hero action)         | present                       |
| EA-25 Metadata versions | —                                            | **gap — no server surface**   |
| EA-26 Metadata drift    | `/dhis2/metadata-drift` (hero action)        | present                       |
| (DER-specific) Overview | `/dhis2`                                     | present                       |
| (DER-specific) Compat   | `/dhis2/compat`                              | present                       |

Documented single DHIS2-group gap: EA-25 Metadata versions. The
spec is generic; building it today would be a stub without the
server-side `metadata_version_log` or equivalent. Deferred to a
later phase when the server endpoint lands.

## Live assertions (post-tag)

| Check                           | Observed                                                       |
|---------------------------------|----------------------------------------------------------------|
| DHIS2 tabs on `/metadata`       | Overview · Connection · Organisation unit · Compatibility · Metadata |
| DHIS2 tabs on `/metadata-drift` | identical to above (drift no longer a tab)                     |
| DHIS2 tabs on `/metadata-sync`  | identical to above (sync no longer a tab)                      |
| Metadata sync hero button       | routes to `/dhis2/metadata-sync`                               |
| Metadata drift hero button      | routes to `/dhis2/metadata-drift`                              |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.22/VNAV-metadata-tabs.png` + `VNAV-drift-tabs.png`.
