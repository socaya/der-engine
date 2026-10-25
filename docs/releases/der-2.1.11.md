# der-2.1.11 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.10`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.1.10 keeps the TriggerPanel directional model + related
tiles on `/sync/metadata` and `/sync/data`, plus every
prior-release regression, stable on the live stack. No code
changes.

## der-2.1.10 live assertions (all green)

Server identity: v2.1.10 · commit `5e77921` · dirty=false.
Topbar OU: `A&A Medcare Medical Centre/Clinic`.

### Trigger pages

| Check                                   | Observed                                                 |
|-----------------------------------------|----------------------------------------------------------|
| `/sync/metadata` direction              | `Central → DER (pull only)` + `one-way`                  |
| `/sync/metadata` related tiles          | Metadata browser · Metadata drift                        |
| `/sync/data` direction                  | `Central ↔ DER (push + pull)` + `two-way`                |
| `/sync/data` related tiles              | Queues · Conflicts · Sync history                        |

### Sync hub regression

| Check                              | Observed                                                 |
|------------------------------------|----------------------------------------------------------|
| Hub hero                           | `Sync`                                                   |
| Stat labels                        | worker · backlog · last sync · last duration · reliability (24h) · last tick |
| Tile grid                          | Jobs · History · Queues · Conflicts · Worker health · Metadata sync · Data exchange · Schedule · Metadata drift |
| Directions panel                   | Metadata `Central → DER` + `one-way`, Data `Central ↔ DER` + `two-way` |
| Jobs pager                         | `1–50 of 200` · Page 1 of 4, 50 rows                     |
| Jobs drawer `EXPLORE PAYLOAD`      | Queues · Conflicts                                       |

### Other regressions

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

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.10/V2110-jobs-drawer.png`.
