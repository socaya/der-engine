# der-2.0.33 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.32`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.0.32 keeps the big-list pagination rollout + merged DHIS2
hub stable on the live stack. No code changes.

## der-2.0.32 live assertions (all green)

Server identity: v2.0.32 · commit `8bbce51` · dirty=false.
Topbar OU: `A&A Medcare Medical Centre/Clinic`.

### Per-page pager survey

| Page                                | Rows / page | Total | Pager                 |
|-------------------------------------|-------------|-------|-----------------------|
| `/dhis2/metadata`                   | 50          | 358   | Page 1 of 8           |
| `/provisioning/users`               | 4           | 4     | Page 1 of 1           |
| `/sync/history`                     | 50          | 200   | Page 1 of 4           |
| `/sync/queues`                      | 0           | 0     | hidden (correct)      |
| `/journal/conflicts`                | 0           | 0     | hidden (correct)      |
| `/audit/events`                     | 50          | 100   | Page 1 of 2           |
| `/compat/history`                   | 50          | 50    | Page 1 of 1           |
| `/dhis2/program-rules`              | 50          | 388   | Page 1 of 8           |

### Interactive flows

| Flow                                             | Observed                       |
|--------------------------------------------------|--------------------------------|
| Metadata — `Next ›` from page 1                  | `1–50 of 358` → `51–100 of 358` |
| Program rules — rows-per-page = `100`            | `1–100 of 388`, 100 rows       |

### DHIS2 hub + regression checks

| Check                                      | Observed                                                   |
|--------------------------------------------|------------------------------------------------------------|
| DHIS2 hub title                            | `DHIS2`                                                    |
| DHIS2 sub-nav tabs                         | Overview · Organisation unit · Compatibility · Metadata    |
| OU cascade (regression)                    | 484 → 278                                                  |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.32/V232-metadata-p2.png`
+ `V232-program-rules.png`.
