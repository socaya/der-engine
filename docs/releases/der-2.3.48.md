# der-2.3.48 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.47`

## Headline

**WorkflowForm follow-ups — program-scoped steps, DHIS2 hierarchy
visibility, admin-UI base fix.** The flat workflow form now behaves
correctly for Event programs, scopes the Steps list to the chosen
program/dataset, and shows the DHIS2 structure explicitly. A build
regression that caused a blank admin page is also fixed.

## 1. Admin-UI base-path default (unblocks blank page)

A production vite build without `DER_ADMIN_UI_BASE=/admin/` wrote
`index.html` referencing `/assets/…`, but the DER server serves
assets at `/admin/assets/…` — the browser 404'd on the main bundle
and rendered blank.

`admin-ui/vite.config.ts` now defaults `BASE` to `/admin/` when
`NODE_ENV=production` so the env var is optional; dev server still
uses `/` for proxy compatibility.

## 2. Program-type filter actually filters

`listPrograms('EVENT')` and `listPrograms('TRACKER')` previously sent
`/api/programs?filter=programType:eq:…` — but the DER mirror's
`/api/programs` controller silently ignores DHIS2 `filter=`
parameters. Both calls returned the same list. Fixed by fetching all
programs (`pageSize=500`) and filtering client-side on
`payload.programType`.

Same bug fixed for `/api/programStages`:
`listProgramStages(programId)` now fetches all stages and filters
client-side by `payload.program.id` — previously every program showed
every stage in the mirror.

`listDataSets()` lifted to `pageSize=500` so datasets aren't capped
at the mirror default of 50.

## 3. Metadata picker — dropdown, not a scrollable list

The size=6 scrollable listbox is replaced by a plain `<select>`
dropdown. A small filter input appears above the dropdown only when
there are more than 12 options and narrows the choices in place
instead of showing a parallel truncated list.

## 4. Event programs now surface stage sections

Previously every Event program showed a single `Whole event` row
with no way to subdivide. DHIS2 event programs have exactly one
program stage which can have program stage sections — now the form
takes the Tracker code path for both Event and Tracker, surfacing
stage + sections. The `EVENT_INSTANCE` placeholder is only used
when `listProgramStages` returns nothing (mirror gap).

## 5. DHIS2 hierarchy visible in Steps

New **Kind** column in the Steps table, rendered as a
quiet-dot `.ea-chip` with a tone:

| Kind | Chip tone |
|---|---|
| Program stage | info |
| Stage section | neutral |
| Dataset section | info |
| Event | info |

So the DHIS2 structure Program → Stage → Section (or Dataset →
Section) is explicit on every row. Child rows (Stage section) stay
indented with `↳ `.

## 6. DER-style section terminology

Workflow / Target / Steps / Dependencies renamed with inline sub-copy
so the handover intent is clear without reading a spec:

- **Workflow settings** — name, status, approval, default device.
- **DHIS2 target** — type + dataset/program picker.
- **Capture steps · owner device & role** — spells out that the
  Role is one of the three canonical DER capture roles defined in
  `CaptureWorkflowStep.OwnerRole` server-side (`OPERATOR` /
  `REVIEWER` / `ADMIN`), and that the Device column is the
  *handover target* (who sees it in *My queue*). Device column is
  renamed **Handover to (device)**.
- **Step order (handover sequence)** — formerly *Dependencies*;
  explains top-to-bottom default + when to add explicit rules.
- **Metadata pin** — adds a short explanation of snapshot pinning.

## 7. Wider form card

The form card now uses `.ea-form-card--wide` (max-width:none) on the
Workflow module so the Steps table + field editor fill the main
content area instead of leaving dead space on the right.

## 8. Files changed

```
admin-ui/vite.config.ts                                — production base default to /admin/
admin-ui/src/screens/workflow/wizardMetadata.ts        — client-side filter for programs
                                                          + program stages; pageSize=500 for datasets
admin-ui/src/screens/workflow/WorkflowForm.tsx         — DHIS2 hierarchy, Kind column,
                                                          event-program stages, DER terminology,
                                                          dropdown picker, wide-card modifier
admin-ui/src/styles.css                                — .ea-form-card--wide,
                                                          .ea-wf-steps-col-kind,
                                                          .ea-metadata-filter
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.48
```

## 9. Verified

```
cd admin-ui && npx tsc --noEmit         ✓ clean
cd admin-ui && npm run build            ✓ 2.3.48 bundle
cd admin-ui && npm test -- --run        241 passed, 4 pre-existing CWF-01 fails
cd server && mvn -q -DskipTests package ✓ der-server-2.3.48.jar
```

## 10. Follow-ups

- Fix the 4 pre-existing CWF-01 RowMenu delete tests.
- Consider server-side filter support on `/api/programs` and
  `/api/programStages` so clients don't need to over-fetch.
