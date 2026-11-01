# der-2.3.52 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.51`

## Headline

**Workflow steps — Kind icons inline + vertical sidebar actually
renders.** Replaces the Kind column with dedicated DER UiIcons in
the Service Point cell, and fixes a CSS specificity bug that was
preventing the inner-sidebar layout from taking effect.

## 1. Kind icons move inline

The Steps table no longer has a separate **Kind** column; a dedicated
UiIcon is rendered inline before the service-point name:

| Kind | Icon |
|---|---|
| Program stage | `tracker-event` |
| Stage section | `program-stage-section` (new DER icon — stage card with highlighted inner section) |
| Dataset section | `aggregate` |
| Event | `event` |

Icon wrapped in a tone-coloured square badge; `title=` + `aria-label=`
preserve the kind label for mouse / keyboard / screen-reader users.
The Repeats refresh icon stays alongside at the right of the service-
point cell for program-stage rows.

HandoverFlowPreview chain picks up the same badge next to each step
title.

## 2. Program stage sections — load fix

`listSectionsForStages` previously relied on
`/api/programStageSections?paging=false&fields=id,displayName,programStage`.
The DER mirror ignores DHIS2's `fields=` and `paging=` parameters;
the sections fetch now uses `pageSize=500` and filters client-side
by `payload.programStage.id` — same pattern already applied to
`/api/programs` and `/api/programStages`.

If sections still don't appear under a program stage, it's because
the upstream DHIS2 instance has no program stage sections configured
(an optional DHIS2 feature). The DER sync will surface them
automatically once an admin defines them upstream.

## 3. Inner-sidebar layout — specificity bug fixed

The split layout shipped in 2.3.51 silently reverted to the old
stacked-section grid because two higher-specificity base rules were
overriding `.ea-form--split`:

```
.ea-main .ea-form-card form.ea-form { display: flex; flex-direction: column }
.ea-form-section { display: grid; grid-template-columns: 220px 1fr }
```

Fixed by scoping the split-layout rules under the same ancestor chain:

```
.ea-main .ea-form-card.ea-form-card--split > form.ea-form.ea-form--split
```

and resetting `.ea-form--split .ea-form-section` to `display:block`
+ `grid-template-columns:none` so sections render as flat panels in
the right-hand column instead of per-section side-headers.

## 4. Files changed

```
admin-ui/src/components/UiIcon.tsx                     — new program-stage-section glyph
admin-ui/src/screens/workflow/WorkflowForm.tsx         — Kind column removed,
                                                          kindIcon helper, inline badge
                                                          in Steps + HandoverFlowPreview
admin-ui/src/screens/workflow/wizardMetadata.ts        — listSectionsForStages uses
                                                          pageSize=500 (ignores DHIS2
                                                          fields=/paging= like the mirror)
admin-ui/src/styles.css                                — .ea-wf-steps-sp-cell,
                                                          .ea-wf-steps-kind-icon*,
                                                          split-layout specificity fix
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.52
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit         ✓ clean
cd admin-ui && npm run build            ✓ 2.3.52 bundle
cd admin-ui && npm test -- --run        241 passed, 4 pre-existing CWF-01 fails
cd server && mvn -q -DskipTests package ✓ der-server-2.3.52.jar
```

## 6. Follow-ups

- Add an inline hint under program-stage rows with no sub-sections
  ("whole stage captured") so operators understand why there's no
  nested breakdown.
- Keyboard navigation on the inner-sidebar rail (Up/Down + Home/End).
- Validation markers on the rail (dot/badge when a section has
  errors).
