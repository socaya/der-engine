# der-2.3.65 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.64`

## Headline

**WorkflowMonitoring — flat nav rail + tighter DER-sidebar margin.**
Minor polish of the inner-sidebar layout shipped in 2.3.64.

## 1. Flat vertical nav rail

The card chrome around `.ea-wf-monitor-nav` is gone: no border, no
background, no padding. Section buttons stack directly on the page
background. `is-active` keeps the navy-700 fill so the current
section still reads clearly, hover still uses the raised tone.

- Nav column slimmed: 200 → 168 px.
- Split gap: `--sp-4` → `--sp-3`.
- Item gap: 1 → 2 px for comfortable click targets without the
  card.

## 2. Tighter DER-sidebar margin

New `.ea-screen--tight` modifier applied only to the Monitoring
root pulls the content inward by `--sp-3` (12 px) on each side via
negative horizontal margin — reducing wasted horizontal gap on
wide monitors without touching the global `.ea-main-inner`
padding. Collapses back to normal below 900 px wide.

## 3. Files changed

```
admin-ui/src/screens/workflow/WorkflowMonitoring.tsx   — root class → .ea-screen--tight
admin-ui/src/styles.css                                 — flatten .ea-wf-monitor-nav,
                                                           slim .ea-wf-monitor-split,
                                                           new .ea-screen--tight modifier
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.65
```

## 4. Verified

```
cd admin-ui && npx tsc --noEmit         ✓ clean
cd admin-ui && npm run build            ✓ 2.3.65 bundle
cd server   && mvn -q -DskipTests package ✓ der-server-2.3.65.jar (no code change)
```

Live stack still runs the 2.3.64 jar; this release is admin-UI-only
(server identical to 2.3.64) so the running process doesn't need a
restart unless you want the `/system/health` version string to flip.
