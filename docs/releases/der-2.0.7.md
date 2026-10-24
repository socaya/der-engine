# der-2.0.7 (stable)

**Date:** 2026-10-24
**Previous stable:** `der-2.0.6`

## Headline

Verification-only release for the OU filter cascade shipped in
`der-2.0.6`. No code changes — this cut bundles the end-to-end
browser-level evidence that the fix behaves as described.

## Evidence (Playwright, live DER + DHIS2 2.44-SNAPSHOT)

| Step | Filters                             | OU count label |
|------|-------------------------------------|---------------:|
| 1    | — initial —                         |        **484** |
| 2    | Level 4 (Health Facility)           |        **278** |
| 3    | Level 4 + search `medcare`          |          **1** |
| 4    | Level 1 (National)                  |          **1** |
| 5    | Reset filters                       |        **484** |

Five desktop screenshots at
`docs/evaluation/evidence/alpha.17-ou-cascade/` show the counter
label update, the level dropdown rendering the real DHIS2 level
names (National / District / Locality / Health Facility, not the
generic `Level N` fallback), and the reset button restoring the
baseline.

Five Playwright assertions all pass:
- `initial === 484`
- `level=4 < 484`
- `level=4 + medcare < level=4`
- `level=1 === 1`
- `reset === 484`
