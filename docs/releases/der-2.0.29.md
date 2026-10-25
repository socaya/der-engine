# der-2.0.29 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.28`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.0.28 keeps the subtitle + inline OU bar + Metadata
developer-label removal clean on the live stack. No code
changes.

## der-2.0.28 live assertions (all 28 green)

| Check                                          | Observed                                 |
|------------------------------------------------|------------------------------------------|
| Server identity                                | v2.0.28 · commit `d752aba` · dirty=false |
| Topbar OU                                      | `A&A Medcare Medical Centre/Clinic`      |
| `.ea-hero-sub` visible                         | 0 on 10 verified pages                   |
| `.ea-dash-hero-sub` visible                    | 0 on 10 verified pages                   |
| `.ea-ou-bar` visible                           | 0 on 10 verified pages                   |
| DHIS2 sub-nav                                  | Overview · Connection · Organisation unit · Compatibility · Metadata |
| Active-tab per DHIS2 route                     | one tab active per route (5/5)           |
| Metadata hero title                            | "Metadata"                               |
| Metadata resource picker                       | 45 options                               |
| Tracked entity attributes                      | `— 54 items`                             |
| Program stages                                 | `— 76 items`                             |
| `resource dataElements` developer label        | 0                                        |
| Metadata hero actions                          | `Metadata sync`, `Metadata drift`        |
| TEA drawer autofocus                           | `ART number`                             |
| Table cell padding (compact default)           | `6px 10px`                               |
| OU cascade                                     | 484 → 278                                |

Pages verified: `/admin/`, `/dhis2`, `/dhis2/connection`,
`/dhis2/organisation-unit`, `/dhis2/metadata`, `/sync`,
`/sync/history`, `/provisioning/users`, `/data/maintenance`,
`/sync/queues`.

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.28/V228-metadata.png`.
