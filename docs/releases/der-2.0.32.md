# der-2.0.32 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.31`

## Headline

Verification-only cut. Bundles browser-level evidence that the
der-2.0.31 big-list pagination rollout behaves on the live stack
with the full dataset now reachable through every pager. No code
changes.

## der-2.0.31 live assertions (all green)

Server identity: v2.0.31 · commit `31fa66b` · dirty=false.
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

### Interactive assertions

| Flow                                             | Observed                       |
|--------------------------------------------------|--------------------------------|
| Metadata — click `Next ›` from page 1            | `1–50 of 358` → `51–100 of 358` |
| Program rules — rows-per-page selector = `100`   | `1–100 of 388`, 100 rows rendered |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.31/V231-metadata-p2.png`
+ `V231-program-rules.png`.
