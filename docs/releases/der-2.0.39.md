# der-2.0.39 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.38`

## Headline

Verification-only cut. Bundles browser-level evidence that the
der-2.0.38 Organisation-unit modernisation + all prior-release
regressions behave on the live stack. No code changes.

## der-2.0.38 live assertions (all 20 green)

Server identity: v2.0.38 · commit `a763d81` · dirty=false.
Topbar OU: `A&A Medcare Medical Centre/Clinic`.

### Organisation-unit page

| Check                               | Observed                                               |
|-------------------------------------|--------------------------------------------------------|
| Hero title                          | `Organisation unit`                                    |
| `Change organisation unit` button   | visible on load                                        |
| Rebind form on load                 | hidden (reveal-on-action)                              |
| Binding card                        | renders with `A&A Medcare Medical Centre/Clinic`       |
| Clipboard after Copy UID            | `HL2zXaIULBe`                                          |
| After Change click                  | rebind form visible + Cancel button visible            |
| OU-list filter cascade              | 484 total → 278 at level 4                             |
| After Cancel                        | rebind form hidden + Change button restored            |

### Regressions

| Check                               | Observed                                               |
|-------------------------------------|--------------------------------------------------------|
| `/dhis2/metadata` pager             | ✓ 50 of 358                                            |
| `/provisioning/users` pager         | ✓ 4 of 4                                               |
| `/sync/history` pager               | ✓ 50 of 200                                            |
| `/audit/events` pager               | ✓ 50 of 100                                            |
| `/compat/history` pager             | ✓ 50 of 50                                             |
| `/dhis2/program-rules` pager        | ✓ 50 of 388                                            |
| Compat matrix rows                  | 4 (one `live` chip, no `[object Object]`)              |
| DHIS2 hub title                     | `DHIS2`                                                |
| DHIS2 sub-nav tabs                  | Overview · Organisation unit · Compatibility · Metadata |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.38/V238-ou-collapsed.png`
+ `V238-ou-rebind-open.png`.
