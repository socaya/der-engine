# der-2.3.82 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.81`

## Headline

**`/data/aggregate` — pipeline strip removed (user feedback).**

The 5-tile stat strip (Captured / In journal / Pending push /
Synced / Needs attention) is dropped. Status-bar row count +
per-row sync-state chips carry enough context without the extra
visual noise. Dead code and the toneColour helper purged.

The server endpoint still returns `pipeline` in its response (used
for the row-count label); the strip component just isn't rendered.

## Files changed

```
admin-ui/src/screens/DataAggregate.tsx                   — PipelineStrip
                                                             + toneColour removed
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.82
```

## Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.82 bundle (851 ms)
```
