# der-2.1.14 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.13`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.1.13's starter-ready + database-tile fixes behave on the
live stack, and that every prior-release regression (Sync hub,
TriggerPanel directions, Jobs pager + explore drawer, OU
breadcrumb, big-list pagers, Compat matrix, DHIS2 hub)
remains green. No code changes.

## der-2.1.13 live assertions (all 25 green)

Server identity: v2.1.13 · commit `35b704b` · status
`starter-ready` · dirty=false.

### Workspace health tiles

| Tile / chip                 | Value                      | Tone      |
|-----------------------------|----------------------------|-----------|
| DER status KPI              | `Live`                     | success   |
| DHIS2 KPI                   | Connected                  | success   |
| Local database KPI          | `Operational`              | success   |
| Synchronisation KPI         | Running                    | success   |
| Hero chip                   | `All systems operational`  | success   |

### Sync hub + sub-pages

| Check                              | Observed                                                 |
|------------------------------------|----------------------------------------------------------|
| Hub hero                           | `Sync`                                                   |
| Stat labels                        | worker · backlog · last sync · last duration · reliability (24h) · last tick |
| Tile grid                          | Jobs · History · Queues · Conflicts · Worker health · Metadata sync · Data exchange · Schedule · Metadata drift |
| Directions panel                   | Metadata `Central → DER` + `one-way`, Data `Central ↔ DER` + `two-way` |
| `/sync/metadata` related tiles     | Metadata browser · Metadata drift                        |
| `/sync/data` related tiles         | Queues · Conflicts · Sync history                        |
| Jobs pager                         | `1–50 of 200` · Page 1 of 4, 50 rows                     |
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

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.13/V2113V-workspace.png`.
