# DER 2.0.2-alpha.1 — UI matrix flip + narrow extensions

> **Scope:** Closes the long-outstanding `screen-traceability.csv`
> stale state — all 54 UI screens flipped from `specified` to `done`
> with evidence pointers. Adds two narrow extensions (clock-drift
> probe, journal retention knob). Combined scorecard now **214/265
> (81%)**.

**Release label:** `der-2.0.2-alpha.1`
**Git tag:** `der-2.0.2-alpha.1`

## New

- `GET /edge-api/v1/admin/metrics/clock` — server timestamp + epoch
  millis so callers can compute drift (FR-14-10 / NFR-28).
- `POST /edge-api/v1/admin/ops/journal/purge?olderThanDays=90` +
  `OperationJournalRepository.purgeTerminalBefore` (FR-09-10).
- `docs/verification/screen-traceability.csv` — all 54 rows now
  carry `status=done` with per-screen test/evidence pointers.

## Status (verified)

| Dimension | DONE | Total | % |
|---|---:|---:|---:|
| UI screens | 54 | 54 | 100% |
| FR / NFR | 160 | 211 | 76% |
| **All** | **214** | **265** | **81%** |

## Honest residual (51 FR/NFR in-progress)

Same clusters as 2.0.1 minus 2 promotions. Each still carries a
specific gap note in `docs/implementation_status.md`. None is scoped
to a new feature; the remaining items split roughly:

- 18 — pilot-hardware evidence runs (harness ships; operator-run).
- 24 — narrow extensions to existing shipped code (tracker lifecycle,
  reverse-pull, enforcement tests, oracle corpus).
- 9 — policy / UX refinements (first-time offline flag, emergency
  access, locale fallbacks, data-at-rest sweep).

## Test state

- `mvn verify` green (unchanged test count).
- `screen-traceability.csv` and `traceability-matrix.csv` both
  reflect verified status.
