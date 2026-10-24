# der-2.0.11 (stable)

**Date:** 2026-10-24
**Previous stable:** `der-2.0.10`

## Headline

Verification-only cut bundling two fresh browser-level evidence runs
against the live stack:

- `der-2.0.9` Workspace consolidation re-verified (9 panels, 5 KPIs,
  2-item nav)
- `der-2.0.10` Admin lifecycle controls verified end-to-end — shutdown
  confirm flow, reload DHIS2 config banner, 65-line log tail, OU
  cascade still intact

No code changes.

## Evidence

- `docs/evaluation/evidence/alpha.18-workspace/der-2.0.9/`
  - `V209-workspace.png`
  - `V209-ou.png`
- `docs/evaluation/evidence/alpha.19-admin-tasks/der-2.0.10/`
  - `V210-admintasks.png`
  - `V210-admintasks-logs.png`

## der-2.0.10 live assertions (all green)

- server reports v2.0.10 · commit `73117bb`
- Workspace section-tabs = `Workspace / System info / Admin tasks`
- Admin tasks KPIs = `Uptime / Heap used / DB sessions / Scheduler`
- panels = `Service control / Sessions / Configuration / Recent server log`
- Shut down button opens a confirm dialog; Cancel path keeps the server up
- Reload DHIS2 config returns OK banner on POST
- Log tail returns 65 lines on default load
- OU cascade: 484 → 278 → 1
- server still responding after the whole test
