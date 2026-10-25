# der-2.0.14 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.13`

## Headline

Verification-only cut. Bundles a fresh end-to-end browser-level
Playwright run that confirms every der-2.0.13 UX fix behaves as
described on the live stack.

No code changes.

## der-2.0.13 live assertions (all green)

| Check                    | Observed                                   |
|--------------------------|--------------------------------------------|
| Server identity          | v2.0.13 · commit `98b676b`                 |
| Topbar OU chip           | `A&A Medcare Medical Centre/Clinic`        |
| Breadcrumbs              | 0 (removed)                                |
| Priority breakdown       | 3 segments + 3 legend rows                 |
| Ring label position      | top 554.3 **below** ring bottom 548.3      |
| System topology          | 3 nodes all on Y 484 — single row          |
| Brand = topbar height    | 60.0 = 60.0                                |
| Logo size                | 40 × 140 px, visible                       |
| Workspace sub-tabs       | `Workspace / System info / Admin tasks`    |
| OU cascade initial       | 484                                        |
| OU cascade level=4       | 278                                        |

11 Playwright assertions all pass.

Evidence: `docs/evaluation/evidence/alpha.24-der-2.0.13/`.
