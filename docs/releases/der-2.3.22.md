# der-2.3.22 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.21`

## Headline

**Field-level selector in the wizard** — operators pick which data
elements each step captures and mark them REQUIRED / OPTIONAL by
name, without seeing a UID. Selection flows straight into the step's
`fields: []` array, which `ProgressiveValidator` already consumes for
§36 REQUIRED_FIELD_MISSING checks (shipped 2.3.17).

## 1. New endpoint

```
GET /edge-api/v1/metadata/field-candidates?kind=X&ref=Y
→ 200
{
  "kind": "PROGRAM_STAGE" | "EVENT_INSTANCE" | "DATASET_SECTION",
  "ref":  "<uid>",
  "fields": [
    { "id": "<de-uid>", "displayName": "Date confirmed HIV-positive",
      "compulsory": true },
    …
  ]
}
```

- `PROGRAM_STAGE` → `metadata_program_stage_data_element` ⋈
  `metadata_data_element` sorted by `sort_order`.
- `EVENT_INSTANCE` → resolves the program's single implicit stage,
  then same as above.
- `DATASET_SECTION` → walks each mirrored dataset's
  `sections[].dataElements[]` JSON until it finds the section UID,
  returns the DEs.
- `compulsory` carries the upstream DHIS2 compulsory flag so the
  wizard pre-ticks and pre-selects REQUIRED.

## 2. UI — wizard step 3

Each row gets an expand button (▸ / ▾). Expanding fetches the row's
field candidates lazily and renders:

```
┌────────────────────────────────────────────────────────────┐
│ [▾] [✓]  ART enrollment and initiation                      │
│        1 field · 1 required                                 │
├────────────────────────────────────────────────────────────┤
│ [Select all] [Clear]                                        │
│  ☑ Date confirmed HIV-positive       [Required ▾]           │
│  ☐ Date of ART initiation                                   │
│  ☐ ART line                                                 │
│  …                                                          │
└────────────────────────────────────────────────────────────┘
```

- One checkbox per field. Upstream-compulsory fields render a muted
  "upstream required" pill.
- When ticked, a Requirement dropdown appears with Required /
  Optional. Default follows upstream `compulsory`.
- A summary line under the breakable name (`N field(s) · M
  required`) always reflects the current selection — operators see
  what's going to be saved without expanding.
- "Select all" / "Clear" bulk buttons.
- Edit mode: the wizard pre-fills the selection from the existing
  workflow's `fields: []` and the row's selection survives metadata
  drift (fields no longer in the current mirror still appear in the
  saved shape under their UID).

## 3. Save pipeline

```typescript
// buildWorkflowPayload input shape
steps: [{
  breakable: Breakable,
  ownerRole: 'OPERATOR' | …,
  ownerDeviceId: string | null,
  fields?: { fieldRef: string;
              requirement: 'REQUIRED' | 'OPTIONAL' | 'READONLY' | 'HIDDEN' }[],
}]
```

- Empty `fields: []` continues to mean "capture everything in the
  section/stage" — server behaviour unchanged for workflows authored
  before this release.
- Non-empty `fields` triggers §36 REQUIRED_FIELD_MISSING checks on
  every contribution.

## 4. Verified live

```
Phase A  GET /field-candidates (ART enrollment stage)   ✓ 11 fields
                                                           sample: "Date confirmed
                                                           HIV-positive"
                                                           compulsory=true
Phase B  wizard flow                                    ✓ 11 fields rendered
                                                           tick field, auto-REQUIRED
                                                           summary: "1 field · 1 required"
Phase C  saved workflow                                 ✓ step.fields=[{qY5G7bs9Egl,
                                                                       REQUIRED}]
Phase D  §36 chain                                      ✓ contribute without
                                                           qY5G7bs9Egl → errorCount=1
                                                           REQUIRED_FIELD_MISSING fires
pageerrors                                              ✓ 0
```

## 5. Files changed

```
server/.../web/MetadataFieldCandidatesController.java   (new)
admin-ui/src/screens/workflow/wizardMetadata.ts         — listFieldCandidates(),
                                                          buildWorkflowPayload fields[]
admin-ui/src/screens/workflow/WorkflowWizard.tsx        — expand row + fieldSelection
                                                          state + helpers + bulk
                                                          select/clear
admin-ui/src/styles.css                                 — ea-wizard-field-selector,
                                                          ea-wizard-field-list,
                                                          ea-icon-btn
VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.22
```

## 6. Build + test

```
tsc -b && vite build                   ✓
mvn -q -DskipTests package             ✓ 2.3.22 JAR
admin-ui unit tests                    241/245 (4 pre-existing baseline failures)
End-to-end: API → wizard → save → §36  ✓ REQUIRED_FIELD_MISSING fires on omission
```

## 7. What this still doesn't do

- `PROGRAM_STAGE_SECTION` splitting on tracker — a program stage can
  itself be sub-divided into sections. The wizard would need a
  three-level checklist (program → stage → section → field). Lands
  as a follow-up.
- Field-level actions (`READONLY`, `HIDDEN`) — accepted in the save
  shape but not yet surfaced in the wizard UI (operators pick only
  Required or Optional for now). Clients that know how to render
  READONLY / HIDDEN will consume them via the existing API.
