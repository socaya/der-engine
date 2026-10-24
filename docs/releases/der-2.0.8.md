# der-2.0.8 (stable)

**Date:** 2026-10-24
**Previous stable:** `der-2.0.7`

## Headline

Version-stamp cut bundling a fresh browser-verification run of the
OU filter cascade against the stable `der-2.0.7` build. No code
changes — this is a post-tag sanity check that the fix stuck and the
live server reports its new version to clients.

## Evidence (Playwright, live DER 2.0.7 + DHIS2 2.44-SNAPSHOT)

Browser-reported server identity:
- version: **2.0.7**
- commit:  **6250605**

Level dropdown rendering real DHIS2 names (not the `Level N` fallback):

```
Any level
Level 1 · National
Level 2 · District
Level 3 · Locality/Area
Level 4 · Health Facility
```

Cascade match counts observed in the live UI label:

| Step | Filters                             | OU count |
|------|-------------------------------------|---------:|
| 1    | — initial —                         |      484 |
| 2    | Level 4                             |      278 |
| 3    | Level 4 + "medcare"                 |        1 |
| 4    | Level 1                             |        1 |
| 5    | Reset                               |      484 |

Six Playwright assertions all green (server version + 5 count checks).

Evidence: `docs/evaluation/evidence/alpha.17-ou-cascade/der-2.0.7/`
