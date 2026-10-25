# der-2.0.16 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.15`

## Headline

Verification-only cut bundling fresh browser-level evidence that the
der-2.0.15 icon cleanup behaves as described on the live stack. No
code changes.

## der-2.0.15 live assertions (all green, 15 / 15)

| Check                        | Observed                                 |
|------------------------------|------------------------------------------|
| Server identity              | v2.0.15 · commit `401b9de`               |
| KPI icon backgrounds         | all `rgba(0, 0, 0, 0)` (transparent)     |
| KPI SVG sizes                | all **24 × 24** (was 18 × 18, +33%)      |
| Topbar OU chip               | `A&A Medcare Medical Centre/Clinic`      |
| Priority breakdown chart     | 3 segments                               |
| System topology              | 3 nodes on Y 484 (single row)            |
| Ring label position          | top 554.3 **below** ring bottom 548.3    |
| OU cascade initial           | 484                                      |
| OU cascade level=4           | 278                                      |

Evidence: `docs/evaluation/evidence/alpha.25-icons/der-2.0.15/`.
