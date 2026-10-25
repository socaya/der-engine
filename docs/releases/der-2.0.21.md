# der-2.0.21 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.20`

## Headline

Verification-only cut. Bundles browser-level evidence that the
der-2.0.20 metadata-coverage expansion behaves as described on
the live stack. No code changes.

## der-2.0.20 live assertions (all 12 green)

| Check                              | Observed                                 |
|------------------------------------|------------------------------------------|
| Server identity                    | v2.0.20 · commit `94a7894`               |
| Topbar OU                          | `A&A Medcare Medical Centre/Clinic`      |
| Metadata picker resource options   | **45**                                   |
| Tracked entity attributes          | `— 54 items`                             |
| Program stages                     | `— 76 items`                             |
| Category option combos             | `— 1 item`                               |
| SQL views                          | `— 10 items`                             |
| Dashboards                         | `— 0 items` (pipeline wired, empty on demo) |
| TEA drawer autofocus               | `ART number`                             |
| Program stages drawer              | `ART enrollment and initiation`          |
| OU cascade                         | 484 → 278                                |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.20/V220-metadata.png`.
