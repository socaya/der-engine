# der-2.1.16 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.15`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.1.15 keeps the SyncLane overlap fix behaving, with every
prior-release regression (health tiles, Sync hub, TriggerPanel
directions, Jobs pager + explore drawer, OU breadcrumb,
big-list pagers, Compat matrix, DHIS2 hub) remaining green. No
code changes.

## der-2.1.15 live assertions (all 25 green)

Server identity: v2.1.15 · commit `2bc6b7b` · status
`starter-ready` · dirty=false.

### SyncLane non-overlap check (the der-2.1.15 fix)

| Row         | gap between col0 (arrow row) and col1 (title + desc) |
|-------------|------------------------------------------------------|
| Metadata    | 14 px                                                |
| Data        | 14 px                                                |

Both gaps positive → no visual overlap.

### Workspace health tiles

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

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.15/V2115V-sync-hub.png`.
