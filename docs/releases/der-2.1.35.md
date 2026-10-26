# der-2.1.35 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.34`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.1.34's Sync-hub restructure (tooltipped lane rationale,
plain-English tile captions, humanised Recent-activity table)
and every prior-release regression stay green on the live
stack. No code changes.

## der-2.1.34 live assertions (all 36 green)

Server identity: v2.1.34 · commit `d9cfc22` · status
`starter-ready` · dirty=false.

### Sync hub restructure

| Check                                         | Observed                                                                                 |
|-----------------------------------------------|------------------------------------------------------------------------------------------|
| Lane body contains "source of truth"          | absent (moved to tooltip)                                                                |
| Lane body contains "Local captures journal"   | absent (moved to tooltip)                                                                |
| Data lane `title=` tooltip                    | `Local captures journal up to central; central-held OU data syncs down…`                 |
| Jobs tile caption                             | `100 recent runs`                                                                        |
| Worker health tile caption                    | `Running smoothly.`                                                                      |
| Schedule tile caption                         | `When each background flow runs.`                                                        |
| Metadata drift tile caption                   | `Mirror matches DHIS2.`                                                                  |
| Recent-activity Job cell                      | `Push outgoing data` (raw `JOURNAL_WORKER_DRAIN` on muted line below)                    |
| Recent-activity outcome chip                  | `Succeeded`                                                                              |

### Workspace health

| Tile / chip                 | Value                      | Tone      |
|-----------------------------|----------------------------|-----------|
| DER status KPI              | `Live`                     | success   |
| DHIS2 KPI                   | `Connected`                | success   |
| Local database KPI          | `Operational`              | success   |
| Hero chip                   | `All systems operational`  | success   |

### Sync-module sub-pages (humanised)

| Check                              | Observed                                                 |
|------------------------------------|----------------------------------------------------------|
| `/sync/jobs` sample                | `Push outgoing data` on raw `JOURNAL_WORKER_DRAIN`       |
| `/sync/history` sample             | includes `accepted`, no raw JSON blob                    |
| `/journal/worker` sample           | `Accepted by DHIS2`, `Will retry`                        |
| `/sync/schedule` first row         | contains `Every 5 minutes` chip                          |

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

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.34/V2134-sync-hub.png`.
