# der-2.0.41 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.40`

## Headline

Verification-only cut. Bundles browser-level evidence that the
der-2.0.40 OU-path display-name resolution works on the live
stack, with the UID still one hover away. No code changes.

## der-2.0.40 live assertions (all green)

Server identity: v2.0.40 · commit `edcd9eb` · dirty=false.
Topbar OU: `A&A Medcare Medical Centre/Clinic`.

### Organisation-unit page

| Check                                 | Observed                                                                                        |
|---------------------------------------|-------------------------------------------------------------------------------------------------|
| Breadcrumb text                       | `Mauritius › Plaines Wilhems › Town of Quatre Bornes - Ward 4 › A&A Medcare Medical Centre/Clinic` |
| Breadcrumb contains raw UID           | no                                                                                              |
| First crumb hover-tooltip (UID)       | `ZEzf44yY3Kd`                                                                                   |
| Copy UID clipboard                    | `HL2zXaIULBe`                                                                                   |
| Rebind reveal / cancel                | open 1 → close 0                                                                                |

### Regressions

| Check                                 | Observed                                                   |
|---------------------------------------|------------------------------------------------------------|
| `/dhis2/metadata` pager               | ✓ 50 of 358                                                |
| `/provisioning/users` pager           | ✓ 4 of 4                                                   |
| `/sync/history` pager                 | ✓ 50 of 200                                                |
| `/audit/events` pager                 | ✓ 50 of 100                                                |
| `/compat/history` pager               | ✓ 50 of 50                                                 |
| `/dhis2/program-rules` pager          | ✓ 50 of 388                                                |
| Compat matrix rows                    | 4 (no `[object Object]`)                                   |
| DHIS2 hub title                       | `DHIS2`                                                    |
| DHIS2 sub-nav tabs                    | Overview · Organisation unit · Compatibility · Metadata    |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.40/V240-ou.png`.
