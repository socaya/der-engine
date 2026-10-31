# der-2.3.13 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.12`

## Headline

**Form-based workflow designer.** The two raw-JSON textareas that
operators had to hand-edit to configure a workflow are replaced with
form inputs — one card per step, one row per dependency, with inline
client-side validation.

The raw-JSON editor is kept behind a collapsed `<details>` panel
("Advanced — edit raw JSON (steps + dependencies)") as an escape hatch
for operators who still want to paste a canonical workflow document.

## 1. New components

```
admin-ui/src/components/workflow/StepsEditor.tsx          (new)
admin-ui/src/components/workflow/DependenciesEditor.tsx   (new)
admin-ui/src/components/workflow/validate.ts              (new)
```

### `StepsEditor`

One form card per step. Each card exposes:

| Field | Control | Notes |
|---|---|---|
| Ordinal | `<input type=number>` | 0-indexed |
| Display name | `<input type=text>` | required |
| Owner role | `<select>` | ADMIN · OPERATOR · REVIEWER |
| Assigned device | `<select>` | populated from `GET /devices` |
| Step kind | `<select>` | CAPTURE · REVIEW · APPROVE · DISPATCH |
| Section kind | `<select>` | all 16 kinds (V045–V054) |
| Section ref | `<input type=text>` | DHIS2 UID; blank for AD_HOC |

New steps are minted with a client-side `crypto.randomUUID()` so
dependency rows reference concrete UUIDs — no server-side placeholder
resolution needed.

### `DependenciesEditor`

One row per dependency. Each row is two step `<select>`s — "step X
depends on step Y" — plus a Remove button. Hidden when steps.length
< 2 (dependencies require at least two steps).

### `validate.ts`

Pre-save client validation that mirrors what the server rejects:

```
NAME_REQUIRED         displayName empty
BINDING_REQUIRED      boundMetadataId empty
ORDINAL_DUPLICATE     two steps share an ordinal
STEP_NAME_REQUIRED    step has no display name
DEP_UNKNOWN_STEP      dependency references a vanished step
DEP_SELF              step depends on itself
DAG_CYCLE             dependency graph is cyclic (classic DFS)
```

Errors render in a red block above the Save button (`data-test=
"cwf02-validation"`) so operators see them inline rather than after a
server round-trip.

## 2. Wire-up

`EACoreScreens.tsx` (`EACaptureWorkflowDesigner`):

- Primary editors are now `<StepsEditor>` + `<DependenciesEditor>`
  consuming local React state.
- Save button runs `validateWorkflow()` first; on failure, errors
  display and no network call is made.
- Save button disables when `displayName` or `boundMetadataId` is
  empty (fast UI gating).
- The Advanced `<details>` panel (closed by default) still carries
  `cwf02-steps` + `cwf02-deps` JSON textareas; when it's open, Save
  prefers the JSON content over form state (operator mode).

## 3. Verified live

End-to-end sweep against the running 2.3.13 build (headless Chromium):

```
form-based designer rendered         ✓  advanced JSON hidden by default
2 DATASET_SECTION steps + 1 dep      ✓  via form inputs only
POST /workflows                      ✓  200 OK, 2 steps + 1 dep
reload /workflows/{id}               ✓  form inputs repopulate
                                        (step 0 name, section kind,
                                        step 1 REVIEWER role, deps row)
empty name → save button disabled    ✓  UI gating works
pageerrors                           ✓  0
```

## 4. Files changed

```
admin-ui/src/components/workflow/StepsEditor.tsx       (new)
admin-ui/src/components/workflow/DependenciesEditor.tsx (new)
admin-ui/src/components/workflow/validate.ts            (new)
admin-ui/src/screens/EACoreScreens.tsx                  — designer rewired
admin-ui/src/screens/EACoreScreens.test.tsx             — JSON invalid-input
                                                          test opens the
                                                          Advanced panel first
VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.13
```

## 5. What this doesn't do yet

- Section-ref picker (today it's a free text input — operators still
  paste UIDs). A metadata-aware picker lands when the metadata-browse
  surface in `EAMetadataOverview` grows into a per-resource picker.
- The 16 section kinds are offered uniformly; the UI doesn't yet grey
  out kinds that are incompatible with the chosen `boundMetadataKind`
  (the server still enforces compatibility and surfaces
  `SECTION_KIND_INVALID` on save).
- Field-level editor (per-step `fields: FieldRequest[]`) — the form
  carries fields through on edit but doesn't yet let operators add or
  remove individual fields.

## 6. Build + test

```
tsc -b && vite build                     ✓
mvn -q -DskipTests package               ✓ 2.3.13 JAR
EACoreScreens.test.tsx                   93/97 (4 pre-existing baseline
                                           failures unrelated to this diff)
End-to-end headless designer sweep       ✓ create → reload → validate
```
