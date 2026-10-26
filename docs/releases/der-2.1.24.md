# der-2.1.24 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.23`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.1.23 keeps the drift hub + every prior-release regression
stable on the live stack. No code changes.

## der-2.1.23 live assertions (all 27 green)

Server identity: v2.1.23 · commit `576242c` · status
`starter-ready` · dirty=false.

### Drift hub

| Check                                    | Observed                                                        |
|------------------------------------------|-----------------------------------------------------------------|
| Hero title                               | `Metadata drift`                                                |
| Status chip                              | `In sync`                                                       |
| Primary action                           | `Recompute drift`                                               |
| Stat labels                              | status · added · removed · modified · entities · snapshot to    |
| Directional lane text                    | contains `Central → DER`, `one-way`                             |
| Related tiles                            | Metadata browser · Metadata sync · Sync history                 |

### Workspace health

| Tile / chip                 | Value                      | Tone      |
|-----------------------------|----------------------------|-----------|
| DER status KPI              | `Live`                     | success   |
| Local database KPI          | `Operational`              | success   |
| Hero chip                   | `All systems operational`  | success   |

### Sync hub + sub-pages

| Check                              | Observed                                                 |
|------------------------------------|----------------------------------------------------------|
| Hub hero                           | `Sync`                                                   |
| Stat labels                        | worker · backlog · last sync · last duration · reliability (24h) · last tick |
| Tile grid                          | Jobs · History · Queues · Conflicts · Worker health · Metadata sync · Data exchange · Schedule · Metadata drift |
| Lane gaps                          | both positive (no overlap)                               |
| `/sync/metadata` related tiles     | Metadata browser · Metadata drift                        |
| `/sync/data` related tiles         | Queues · Conflicts · Sync history                        |
| Jobs pager                         | `1–50 of 200` · Page 1 of 4                              |
| Jobs drawer `EXPLORE PAYLOAD`      | present                                                  |

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

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.23/V2123-drift.png`.
