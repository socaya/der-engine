# der-2.0.37 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.36`

## Headline

Verification-only cut. Bundles browser-level evidence that
der-2.0.36 keeps the compact Compat matrix + capabilities
renderer stable alongside the big-list pagers and DHIS2 hub.
No code changes.

## der-2.0.36 live assertions (all green)

Server identity: v2.0.36 · commit `c0f5d1c` · dirty=false.
Topbar OU: `A&A Medcare Medical Centre/Clinic`.

### Compat matrix

| Check                            | Observed                                                          |
|----------------------------------|-------------------------------------------------------------------|
| Matrix rendered as a table       | yes                                                               |
| Matrix row count                 | 4 (2.41, 2.42, 2.43, 2.44)                                        |
| Live row                         | `matrix-row-V2_44` highlighted + `live` chip                      |
| Matrix columns                   | DHIS2 · PROFILE · STATUS · TRACKER API · AUDIT SURFACE · METADATA BULK · PROGRAM RULES |
| `[object Object]` on page        | no                                                                |
| JSON `<pre>` block count         | 1 (`endpointPolicies`)                                            |

### Regression — pager survey

| Page                       | Rows / page | Pager |
|----------------------------|-------------|-------|
| `/dhis2/metadata`          | 50          | ✓     |
| `/provisioning/users`      | 4           | ✓     |
| `/sync/history`            | 50          | ✓     |
| `/audit/events`            | 50          | ✓     |
| `/compat/history`          | 50          | ✓     |
| `/dhis2/program-rules`     | 50          | ✓     |

### Regression — hub + OU

| Check                      | Observed                                                   |
|----------------------------|------------------------------------------------------------|
| DHIS2 hub title            | `DHIS2`                                                    |
| DHIS2 sub-nav tabs         | Overview · Organisation unit · Compatibility · Metadata    |
| OU cascade                 | 484 → 278                                                  |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.36/V236-compat.png`.
