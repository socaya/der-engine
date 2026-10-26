# der-2.1.31 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.30`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.1.30 keeps the drift hub + every prior-release regression
stable on the live stack. No code changes.

## der-2.1.30 live assertions (all 29 green)

Server identity: v2.1.30 · commit `f46d19a` · status
`starter-ready` · dirty=false.

### Workspace health (live probe)

| Tile / chip                 | Value                      | Tone      |
|-----------------------------|----------------------------|-----------|
| DER status KPI              | `Live`                     | success   |
| DHIS2 KPI                   | `Connected`                | success   |
| Local database KPI          | `Operational`              | success   |
| Hero chip                   | `All systems operational`  | success   |

### Sync hub + sub-pages

| Check                              | Observed                                                 |
|------------------------------------|----------------------------------------------------------|
| Hub hero                           | `Sync`                                                   |
| Stat labels                        | worker · backlog · last sync · last duration · reliability (24h) · last tick |
| Tile grid                          | Jobs · History · Queues · Conflicts · Worker health · Metadata sync · Data exchange · Schedule · Metadata drift |
| Lane gaps                          | both positive (no overlap)                               |
| `/sync/metadata` direction + tiles | `Central → DER (one-way)` · Metadata browser · Metadata drift |
| `/sync/data` direction + tiles     | `Central ↔ DER (two-way)` · Queues · Conflicts · Sync history |

### Drift hub

| Check                              | Observed                                                        |
|------------------------------------|-----------------------------------------------------------------|
| Hero title                         | `Metadata drift`                                                |
| Status chip                        | `In sync`                                                       |
| Stat labels                        | status · added · removed · modified · entities · snapshot to    |
| Directional lane text              | contains `Central → DER`                                        |
| Related tiles                      | Metadata browser · Metadata sync · Sync history                 |

### Jobs + big-list pagers

| Check                              | Observed                                                   |
|------------------------------------|------------------------------------------------------------|
| Jobs pager                         | `1–50 of 200` · Page 1 of 4                                |
| Jobs drawer `EXPLORE PAYLOAD`      | present                                                    |
| `/dhis2/metadata`                  | ✓                                                          |
| `/provisioning/users`              | ✓                                                          |
| `/sync/history`                    | ✓                                                          |
| `/audit/events`                    | ✓                                                          |
| `/compat/history`                  | ✓                                                          |
| `/dhis2/program-rules`             | ✓                                                          |

### Other regressions

| Check                              | Observed                                                   |
|------------------------------------|------------------------------------------------------------|
| OU breadcrumb                      | `Mauritius › Plaines Wilhems › Town of Quatre Bornes - Ward 4 › A&A Medcare Medical Centre/Clinic` (no raw UID) |
| Compat matrix                      | 4 rows, no `[object Object]`                               |
| DHIS2 hub                          | `DHIS2` · Overview · Organisation unit · Compatibility · Metadata |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.30/V2130-drift.png`.
