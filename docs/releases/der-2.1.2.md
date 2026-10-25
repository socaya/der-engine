# der-2.1.2 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.1.1`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.1.1 keeps the Sync hub + directional model + Jobs
payload exploration + all prior-release regressions stable on
the live stack. No code changes.

## der-2.1.1 live assertions (all green)

Server identity: v2.1.1 · commit `6a85b70` · dirty=false.
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
| Page 1 range                       | `1–50 of 200` · Page 1 of 4                              |
| Rows rendered                      | 50                                                       |
| Next click                         | `51–100 of 200` · Page 2 of 4                            |
| Drawer "Explore payload" section   | present                                                  |
| Drawer links for `JOURNAL_WORKER_DRAIN` | Queues · Conflicts                                  |

### Regressions

| Check                              | Observed                                                   |
|------------------------------------|------------------------------------------------------------|
| OU breadcrumb                      | `Mauritius › Plaines Wilhems › Town of Quatre Bornes - Ward 4 › A&A Medcare Medical Centre/Clinic` (no raw UID) |
| `/dhis2/metadata` pager            | ✓                                                          |
| `/sync/history` pager              | ✓                                                          |
| `/audit/events` pager              | ✓                                                          |
| `/compat/history` pager            | ✓                                                          |
| `/dhis2/program-rules` pager       | ✓                                                          |
| Compat matrix                      | 4 rows, no `[object Object]`                               |
| DHIS2 hub                          | `DHIS2` · Overview · Organisation unit · Compatibility · Metadata |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.1/V211V-jobs-drawer.png`
(+ `V211V-sync-hub.png`, `V211F-sync-hub.png`, `V211F-jobs-drawer.png`,
`V211-sync-directions.png` from the preceding iterations).
