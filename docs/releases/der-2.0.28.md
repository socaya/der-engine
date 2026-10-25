# der-2.0.28 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.27`

## Headline

Verification-only cut. Bundles browser-level evidence that the
der-2.0.27 subtitle + OU-bar removal behaves cleanly on the
live stack. No code changes.

## der-2.0.27 live assertions (all 27 green)

| Check                                          | Observed                                 |
|------------------------------------------------|------------------------------------------|
| Server identity                                | v2.0.27 · commit `aa284cc` · dirty=false |
| Topbar OU                                      | `A&A Medcare Medical Centre/Clinic`      |
| `.ea-hero-sub` visible                         | 0 on all 10 verified pages               |
| `.ea-dash-hero-sub` visible                    | 0 on all 10 verified pages               |
| `.ea-ou-bar` visible                           | 0 on all 10 verified pages               |
| DHIS2 sub-nav                                  | Overview · Connection · Organisation unit · Compatibility · Metadata |
| Active-tab per DHIS2 route                     | one tab active per route (5/5)           |
| Metadata hero title                            | "Metadata"                               |
| Metadata resource picker                       | 45 options                               |
| `resource dataElements` developer label        | 0                                        |
| Metadata hero actions                          | `Metadata sync`, `Metadata drift`        |
| TEA drawer autofocus                           | `ART number`                             |
| Table cell padding (compact default)           | `6px 10px`                               |
| OU cascade                                     | 484 → 278                                |

Pages verified: `/admin/`, `/dhis2`, `/dhis2/connection`,
`/dhis2/organisation-unit`, `/dhis2/metadata`, `/sync`,
`/sync/history`, `/provisioning/users`, `/data/maintenance`,
`/sync/queues`.

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.27/V227F-metadata.png`
+ `V227F-ou.png`.
