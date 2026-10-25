# der-2.0.26 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.25`

## Headline

Verification-only cut. Bundles browser-level evidence that the
der-2.0.25 flat UI redesign behaves on the live stack with the
SectionTabs active-tab fix now carried in git. No further code
changes beyond the fix already committed as `619893e`.

## der-2.0.25 live assertions (all 20 green)

| Check                                        | Observed                                                           |
|----------------------------------------------|--------------------------------------------------------------------|
| Server identity                              | v2.0.25 · commit `619893e` · dirty=false                           |
| Topbar OU                                    | `A&A Medcare Medical Centre/Clinic`                                |
| Hero computed background                     | `rgba(0, 0, 0, 0)`                                                 |
| Hero computed box-shadow                     | `none`                                                             |
| Hero computed border-width                   | `0px`                                                              |
| Hero OU chip count                           | 0 (OU lives only on the topbar)                                    |
| DHIS2 sub-nav tabs                           | Overview · Connection · Organisation unit · Compatibility · Metadata |
| Active tab on `/dhis2`                       | `tab-dhis2-overview` only                                          |
| Active tab on `/dhis2/connection`            | `tab-central-conn` only                                            |
| Active tab on `/dhis2/organisation-unit`     | `tab-ou-binding` only                                              |
| Active tab on `/dhis2/compat`                | `tab-compat` only                                                  |
| Active tab on `/dhis2/metadata`              | `tab-metadata-mirror` only                                         |
| Metadata hero title                          | "Metadata"                                                         |
| Metadata resource picker option count        | **45**                                                             |
| Tracked entity attributes option label       | `— 54 items`                                                       |
| Metadata sync hero action                    | present, routes to `/dhis2/metadata-sync`                          |
| Metadata drift hero action                   | present, routes to `/dhis2/metadata-drift`                         |
| TEA drawer autofocus                         | `ART number`                                                       |
| Table cell padding (dense default)           | `6px 10px`                                                         |
| OU cascade                                   | 484 → 278                                                          |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.25/V225-metadata.png`.
