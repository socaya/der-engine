# der-2.1.30 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.29`

## Headline

Verification-only cut. Bundles browser-level evidence from a
cold-start of the full stack — Tomcat 10 restarted from
`brew services`, DHIS2 2.44-SNAPSHOT redeployed, Postgres 17
still live, DER server relaunched — confirming the der-2.1.29
build behaves end-to-end against a fresh DHIS2 instance. No
code changes.

## der-2.1.29 live assertions (all 32 green)

Server identity: v2.1.29 · commit `6b46c10` · status
`starter-ready` · dirty=false.

### Stack bring-up

| Service                         | Port | Observed                                         |
|---------------------------------|------|--------------------------------------------------|
| Postgres 17                     | 5432 | `accepting connections`                          |
| DHIS2 2.44-SNAPSHOT (Tomcat 10) | 8080 | `/dhis/api/system/info` → HTTP 200               |
| DER server                      | 8085 | `starter-ready`, dirty=false                     |
| DER admin UI                    | 8085 | `/admin/` → HTTP 200                             |

### Workspace health

| Tile / chip                 | Value                      | Tone      |
|-----------------------------|----------------------------|-----------|
| DER status KPI              | `Live`                     | success   |
| DHIS2 KPI                   | `Connected`                | success   |
| Local database KPI          | `Operational`              | success   |
| Hero chip                   | `All systems operational`  | success   |

### DHIS2 hub

| Check                           | Observed                                                     |
|---------------------------------|--------------------------------------------------------------|
| Hub title                       | `DHIS2`                                                      |
| Sub-nav tabs                    | Overview · Organisation unit · Compatibility · Metadata      |
| Status strip (right of yes/no)  | `2.44-SNAPSHOT · V2_44 · 738 ms · Basic · 57s ago`           |

### Compat matrix

| Check                           | Observed                                   |
|---------------------------------|--------------------------------------------|
| Rendered rows                   | 4                                          |
| Active-row highlight            | `matrix-row-V2_44`                         |
| `[object Object]` present       | no                                         |

### Metadata screen

| Check                           | Observed                                   |
|---------------------------------|--------------------------------------------|
| Hero title                      | `Metadata`                                 |
| Resource picker options         | 45                                         |
| Pager                           | `1–50 of 358` · Page 1 of 8                |

### Organisation-unit

| Check                           | Observed                                                                                           |
|---------------------------------|----------------------------------------------------------------------------------------------------|
| Breadcrumb                      | `Mauritius › Plaines Wilhems › Town of Quatre Bornes - Ward 4 › A&A Medcare Medical Centre/Clinic` |
| Contains raw UIDs               | no                                                                                                 |
| OU cascade                      | 484 → 278 at level 4                                                                              |

### Sync hub + sub-pages

| Check                              | Observed                                                 |
|------------------------------------|----------------------------------------------------------|
| Hub hero                           | `Sync`                                                   |
| Stat labels                        | worker · backlog · last sync · last duration · reliability (24h) · last tick |
| Tile grid                          | Jobs · History · Queues · Conflicts · Worker health · Metadata sync · Data exchange · Schedule · Metadata drift |
| Lane gaps                          | 14 px, 14 px (no overlap)                                |
| `/sync/metadata` direction + tiles | `Central → DER (one-way)` · Metadata browser · Metadata drift |
| `/sync/data` direction + tiles     | `Central ↔ DER (two-way)` · Queues · Conflicts · Sync history |
| Drift hub                          | `Metadata drift` · `In sync` · Central → DER · one-way   |
| Jobs pager                         | present                                                  |
| Jobs drawer `EXPLORE PAYLOAD`      | present                                                  |

### Big-list pager survey

| Page                              | Rows / page | Pager |
|-----------------------------------|-------------|-------|
| `/provisioning/users`             | 4           | ✓     |
| `/sync/history`                   | 50          | ✓     |
| `/audit/events`                   | 50          | ✓     |
| `/compat/history`                 | 50          | ✓     |
| `/dhis2/program-rules`            | 50          | ✓     |

Evidence: this run was executed against the full stack after a
cold restart. All 32 assertions passed in a single Playwright
session; no screenshots retained for this cut.
