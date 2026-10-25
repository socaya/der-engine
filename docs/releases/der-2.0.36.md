# der-2.0.36 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.35`

## Headline

Verification-only cut. Bundles browser-level evidence that the
der-2.0.35 compact Compat matrix + capabilities-rendering fix
behave on the live stack. No code changes.

## der-2.0.35 live assertions (all green)

Server identity: v2.0.35 · commit `c81ec18` · dirty=false.
Topbar OU: `A&A Medcare Medical Centre/Clinic`.

### Compat matrix

| Check                                    | Observed                                                  |
|------------------------------------------|-----------------------------------------------------------|
| Matrix rendered as a table               | yes                                                       |
| Matrix row count                         | 4 (2.41, 2.42, 2.43, 2.44)                                |
| Live row                                 | `matrix-row-V2_44` highlighted with the `live` chip       |
| Matrix columns                           | DHIS2 · PROFILE · STATUS · TRACKER API · AUDIT SURFACE · METADATA BULK · PROGRAM RULES |
| `[object Object]` on page                | no (removed)                                              |
| JSON `<pre>` block count                 | 1 (for `endpointPolicies`)                                |

### Regression — pager survey still green

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

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.35/V235-compat.png`.
