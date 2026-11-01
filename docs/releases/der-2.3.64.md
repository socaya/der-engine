# der-2.3.64 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.63`

## Headline

**Monitoring gets a vertical inner-sidebar so the 11 panels no longer
stack into endless scrolling + the `/system/health` `dhis2Integrated`
flag now reports the truth.**

## 1. WorkflowMonitoring — vertical inner sidebar

Previously the Monitoring page stacked all 11 panels vertically.
Reorganised into 5 scannable sections reachable via a sticky
left-side nav rail inside the content area:

| Section | Panels |
|---|---|
| **Attention** | Blockages · Open issues · Pending conflicts |
| **Activity**  | Draft data captured · Recent activity |
| **Queue depth** | By workflow · By owner device · Service-point pressure |
| **Performance** | Turnaround percentiles · Device turnaround |
| **Prefetch readiness** | Per-device prefetch state |

Each nav item carries a live count badge (e.g. Attention shows
blocked + error issues + conflicts). Non-selected sections are
`hidden` in the DOM so state is preserved when switching. Collapses
to a horizontal strip under 900 px wide (reuses the responsive
pattern used by WorkflowForm's inner nav rail).

The `SyncStatusBar` subtitle keeps the full facts row above the
split so the global roll-up stays visible regardless of which
section is active.

## 2. `/system/health` — `dhis2Integrated` now computed

Historically `dhis2Integrated` was hardcoded `false` ("deliberately
honest until Phase 01+ proves otherwise"). Phase 01+ has long
landed and the server is bound; the flag was a lie.

Fixed in `SystemController` — the flag now evaluates to `true`
when the runtime config carries both a central base URL and at
least one credential (password or PAT). Does **not** probe
reachability; that lives on `/edge-api/v1/dhis2/ping` where it
belongs.

```json
GET /edge-api/v1/system/health
{
  "service": "der-server",
  "status": "UP",
  "version": "2.3.64",
  "dhis2Integrated": true,     ← now reflects runtime config
  "dhis2Reference": { "version": "2.44-SNAPSHOT" },
  …
}
```

Reachability + probe RTT still live under `/edge-api/v1/dhis2/ping`
+ `/edge-api/v1/dhis2/compat` — the health endpoint stays an
unauthenticated readiness probe that doesn't fan out to central.

## 3. Files changed

```
server/src/main/java/.../web/SystemController.java        — compute dhis2Integrated
                                                             from Dhis2ConnectionConfig
server/src/test/java/.../web/SystemControllerTest.java   — + Dhis2 mock bean stub
admin-ui/src/screens/workflow/WorkflowMonitoring.tsx     — split-layout nav rail +
                                                             per-section hidden wrappers
admin-ui/src/styles.css                                   — .ea-wf-monitor-split/.-nav/-item/-badge/
                                                             -panels + responsive collapse
VERSION / server/pom.xml / admin-ui/package.json / sw.js   — 2.3.64
```

## 4. Verified

```
cd server    && mvn -q -DskipTests compile  ✓ clean (Checkstyle included)
cd server    && mvn -q -DskipTests package  ✓ der-server-2.3.64.jar
cd admin-ui  && npx tsc --noEmit            ✓ clean
cd admin-ui  && npm run build               ✓ 2.3.64 bundle
```

## 5. Follow-ups

- Row-level drill into blockage / issue / conflict rows to a
  dedicated admin-side detail panel.
- Section-local refresh — right now Refresh fans across every
  endpoint; per-section refresh buttons would be lighter.
