# der-2.1.7 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.1.6`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.1.6 keeps the Sync hub + directional model + Jobs
payload exploration + all prior-release regressions stable on
the live stack. No code changes.

## der-2.1.6 live assertions (all green)

Server identity: v2.1.6 · commit `e0d49c8` · dirty=false.
Topbar OU: `A&A Medcare Medical Centre/Clinic`.

### Sync hub

| Check                              | Observed                                                 |
|------------------------------------|----------------------------------------------------------|
| Hero title                         | `Sync`                                                   |
| Toggle button                      | `Pause sync` (worker currently running)                  |
| Stat labels                        | worker · backlog · last sync · last duration · reliability (24h) · last tick |
| Tile grid                          | Jobs · History · Queues · Conflicts · Worker health · Metadata sync · Data exchange · Schedule · Metadata drift |
| Directions panel                   | Metadata `Central → DER` + `one-way`, Data `Central ↔ DER` + `two-way` |

### Jobs pager + Explore payload

| Check                              | Observed                                                 |
|------------------------------------|----------------------------------------------------------|
| Page 1                             | `1–50 of 200` · Page 1 of 4, 50 rows                     |
| After Next                         | `51–100 of 200` · Page 2 of 4                            |
| Drawer `EXPLORE PAYLOAD` section   | present                                                  |
| `JOURNAL_WORKER_DRAIN` links       | Queues · Conflicts                                       |

### Regressions

| Check                              | Observed                                                   |
|------------------------------------|------------------------------------------------------------|
| OU breadcrumb                      | `Mauritius › Plaines Wilhems › Town of Quatre Bornes - Ward 4 › A&A Medcare Medical Centre/Clinic` (no raw UID) |
| `/dhis2/metadata` pager            | ✓                                                          |
| `/provisioning/users` pager        | ✓                                                          |
| `/sync/history` pager              | ✓                                                          |
| `/audit/events` pager              | ✓                                                          |
| `/compat/history` pager            | ✓                                                          |
| `/dhis2/program-rules` pager       | ✓                                                          |
| Compat matrix                      | 4 rows, no `[object Object]`                               |
| DHIS2 hub                          | `DHIS2` · Overview · Organisation unit · Compatibility · Metadata |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.6/V216-jobs-drawer.png`.
