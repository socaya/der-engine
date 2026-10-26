# der-2.1.33 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.32`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.1.32's Sync-module humanisations (Jobs, History,
Journal worker, Schedule) behave end-to-end and every
prior-release regression stays green. No code changes.

## der-2.1.32 live assertions (all 32 green)

Server identity: v2.1.32 · commit `ac4d72e` · status
`starter-ready` · dirty=false.

### Sync-module humanisations

| Check                                | Observed                                                  |
|--------------------------------------|-----------------------------------------------------------|
| `/sync/jobs` humanised label         | yes — e.g. `Push outgoing data` (JOURNAL_WORKER_DRAIN)    |
| `/sync/jobs` raw constant tooltip    | yes — raw ID still rendered under label                   |
| `/sync/history` sentence summary     | yes — `0 accepted · 0 rejected · 0 to retry`             |
| `/sync/history` raw JSON column      | removed                                                   |
| `/journal/worker` humanised states   | yes — `Accepted by DHIS2`, `Will retry`                   |
| `/sync/schedule` plain-English cron  | yes — `Every 5 minutes`                                   |

### Workspace health

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
| Drift hub                          | `Metadata drift` · `In sync` · `Central → DER`           |

### Other regressions

| Check                              | Observed                                                   |
|------------------------------------|------------------------------------------------------------|
| OU breadcrumb                      | `Mauritius › Plaines Wilhems › Town of Quatre Bornes - Ward 4 › A&A Medcare Medical Centre/Clinic` (no raw UID) |
| `/dhis2/metadata` pager            | ✓                                                          |
| `/provisioning/users` pager        | ✓                                                          |
| `/audit/events` pager              | ✓                                                          |
| `/compat/history` pager            | ✓                                                          |
| `/dhis2/program-rules` pager       | ✓                                                          |
| Compat matrix                      | 4 rows, no `[object Object]`                               |
| DHIS2 hub                          | `DHIS2` · Overview · Organisation unit · Compatibility · Metadata |

Evidence under `docs/evaluation/evidence/alpha.35-der-2.1.32/`:
`V2132-jobs.png`, `V2132-history.png`, `V2132-worker.png`,
`V2132-schedule.png` (plus the `VF-*` set from the build run).
