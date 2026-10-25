# der-2.0.24 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.23`

## Headline

Verification-only cut. Bundles browser-level evidence that the
der-2.0.23 DHIS2 sub-nav cleanup behaves as designed on the live
stack. No code changes.

## der-2.0.23 live assertions (all 20 green)

| Check                             | Observed                                                           |
|-----------------------------------|--------------------------------------------------------------------|
| Server identity                   | v2.0.23 · commit `478777a` · dirty=false                           |
| Topbar OU                         | `A&A Medcare Medical Centre/Clinic`                                |
| Metadata hero title               | "Metadata"                                                         |
| Metadata hero copy                | "Read-only mirror … DER does not create, update or delete"         |
| DHIS2 sub-nav tabs                | Overview · Connection · Organisation unit · Compatibility · Metadata |
| Drift / Sync in tab strip         | absent (expected)                                                  |
| Tabs on `/dhis2/metadata-drift`   | identical to above                                                 |
| Hero sync button → route          | `/dhis2/metadata-sync`                                             |
| Hero drift button → route         | `/dhis2/metadata-drift`                                            |
| Resource picker option count      | **45**                                                             |
| Tracked entity attributes         | `— 54 items`                                                       |
| Program stages                    | `— 76 items`                                                       |
| Category option combos            | `— 1 item`                                                         |
| SQL views                         | `— 10 items`                                                       |
| TEA drawer autofocus              | `ART number`                                                       |
| OU cascade                        | 484 → 278                                                          |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.23/V223-metadata.png`.
