# der-2.3.122 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.121`

## Headline

**R-AR — clean-up release.** Removes the diagnostic scaffolding
shipped mid-flight while chasing the "Lineage drawer not opening"
report (click-diag pill, build marker, Probe button, Reset-cache
button, console.log tripwires, five Playwright diagnose-\*
specs). Keeps the real fixes landed under that same investigation:

| Fix | Status |
|---|---|
| `/favicon.ico`, `/favicon.svg`, `/admin/favicon.svg` all serve DER navy icon | retained |
| Drawer backdrop click-to-close removed (both PayloadLineageDrawer + CentralPayloadDrawer); Esc / Close button only | retained |
| Document-level Escape handler so Esc works without drawer focus | retained |
| Mid-session 401 → `window.location.replace('/admin/sign-in?reason=session-expired')` interceptor (skips auth probes) | retained |
| Lineage buttons' `stopPropagation` on row-containing tables | retained |

## 1. Removed diagnostic scaffolding

- `ClickDiagnostic` component + its `<ClickDiagnostic />` mount in `App.tsx`
- `build v2.3.121 · lineage-diag` text marker above the tracker table
- `Reset cache + reload` button
- `Probe: open Lineage for first row` button
- `clickCount` state + the "Lineage click received (N) but drawer not open" warning banner
- `console.log('[DataTracker] Lineage click ...')` inside the per-row button handler
- `admin-ui/e2e/diagnose-*.spec.ts` (five files) + `admin-ui/playwright.diagnose.config.ts` + `admin-ui/playwright-diagnose-output/`

The scaffolding was useful proof that the Lineage click reached the
handler on the live server; now that we've isolated the real
cause (double-click dismissal of the drawer backdrop), the pills
and probes are noise.

## 2. Live verification

```
GET /system/health                       → 200
GET /favicon.ico                         → 200 (image/svg+xml)
GET /admin/sw.js                         → SW_VERSION = der-admin-v2.3.122
tsc --noEmit                             → clean
```

Running jar: `der-server-2.3.122.jar`.

## 3. Files changed

```
admin-ui/src/App.tsx                        — drop ClickDiagnostic + its mount
admin-ui/src/screens/DataTracker.tsx         — drop build marker, probe,
                                               reset-cache button, click
                                               counter, console.log
admin-ui/e2e/diagnose-*.spec.ts              — deleted (5)
admin-ui/playwright.diagnose.config.ts       — deleted
admin-ui/playwright-diagnose-output/         — deleted
VERSION / server/pom.xml
  / admin-ui/package.json / admin-ui/public/sw.js — 2.3.122
```

## 4. What's next

Phase 7 — "finish-the-flow" — kicks off from this clean baseline:

- 7.1 Draft → submission publish flow
- 7.2 Approval merge enforcement in `JournalPublisher`
- 7.3 Audit + wire `data-cross-module` drill paths
