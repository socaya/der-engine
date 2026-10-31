# der-2.3.1 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.0`

## Headline

**Workflow section kind 1/9 — `ENROLLMENT_FORM`.** First of the nine
new DHIS2 v41+ distribution points the Workflows plan commits to. A
step marked `ENROLLMENT_FORM` captures the tracker enrollment layer
(enrollmentDate / incidentDate / orgUnit / status + the attributes
recorded on the enrollment form) and the compiler folds it into a
dedicated `enrollment` block on the compiled submission.

### Field-level form splitting — confirmed covered already

In parallel with the march, this release note confirms a related
capability the product owner called out: splitting a single DHIS2
dataset / program into field-level subsets that go to different
devices. That's already how `fields[]` on each step works today —
set `sectionKind: AD_HOC` and list the fields a step owns; the
compiler merges contributions by `(dataElement, categoryOptionCombo)`
back into one DHIS2 `dataValues[]`. No new kind needed for that case.

## 1. Schema (V046)

```sql
der.capture_workflow_step
  CHECK section_kind IN (
      'DATASET_SECTION','PROGRAM_STAGE','PROGRAM_STAGE_SECTION',
      'TEI_ATTRIBUTE_GROUP','DATA_ELEMENT_GROUP','COC_SPLIT',
      'ENROLLMENT_FORM',    -- V046
      'AD_HOC')
```

## 2. Validation matrix

`sectionKindCompatible()` now accepts `ENROLLMENT_FORM` under `PROGRAM`
binding only:

| Binding | Allowed step kinds |
|---|---|
| `DATA_SET` | DATASET_SECTION / DATA_ELEMENT_GROUP / COC_SPLIT / AD_HOC |
| **`PROGRAM`** | PROGRAM_STAGE / PROGRAM_STAGE_SECTION / TEI_ATTRIBUTE_GROUP / DATA_ELEMENT_GROUP / **ENROLLMENT_FORM** / AD_HOC |
| `PROGRAM_STAGE` | PROGRAM_STAGE_SECTION / DATA_ELEMENT_GROUP / AD_HOC |
| `PROGRAM_STAGE_SECTION` | DATA_ELEMENT_GROUP / AD_HOC |

## 3. Compiler — enrollment merge

`WorkflowCompiler.compileProgram()` now carries an `enrollment` object:

- Any step with `sectionKind: ENROLLMENT_FORM` folds its payload into
  the enrollment block.
- Merged keys: `enrollment`, `enrollmentDate`, `incidentDate`,
  `orgUnit`, `status`, `trackedEntity`, `geometry`, `program`,
  `deleted`.
- `enrollmentAttributes[]` becomes `enrollment.attributes[]` on the
  compiled output.
- Non-enrollment attributes stay in the workflow-level `attributes[]`
  for backward compat with 2.3.0.

Later-ordinal steps overwrite earlier values when they target the same
field.

## 4. Admin UI

- `edgeApi.SectionKind` type extended.
- Designer JSON hint lists `ENROLLMENT_FORM` as an available kind.
- Visual designer still deferred to 2.3.X (per the Workflows plan).

## 5. Verified live

```
POST /workflows with PROGRAM binding + ENROLLMENT_FORM step
  → 200 OK; stored with sectionKind=ENROLLMENT_FORM ✓

POST /workflows with DATA_SET binding + ENROLLMENT_FORM step
  → 400 SECTION_KIND_INVALID
  "step 'bad' sectionKind=ENROLLMENT_FORM is not valid for a DATA_SET workflow" ✓

POST /workflows with PROGRAM_STAGE binding + ENROLLMENT_FORM step
  → 400 SECTION_KIND_INVALID ✓

pageerrors: 0
```

## 6. Files changed

```
database/migrations/V046__workflow_enrollment_section.sql     (new)
server/.../workflow/CaptureWorkflowStep.java                   — + ENROLLMENT_FORM
server/.../workflow/WorkflowCompiler.java                      — enrollment merge path
server/.../web/CaptureWorkflowController.java                  — PROGRAM allows ENROLLMENT_FORM
admin-ui/src/api/edgeApi.ts                                    — SectionKind + ENROLLMENT_FORM
admin-ui/src/screens/EACoreScreens.tsx                         — designer hint
VERSION / server/pom.xml / admin-ui/package.json / sw.js       — bumped to 2.3.1
```

## 7. Progress on the 9-kind march

| # | Release | Section kind | Status |
|---|---|---|---|
| 1 | **2.3.1** | **ENROLLMENT_FORM** | **✓ shipped** |
| 2 | 2.3.2 | PROGRAM_SECTION | queued |
| 3 | 2.3.3 | TEI_TYPE_ATTRIBUTES | queued |
| 4 | 2.3.4 | ATTRIBUTE_OPTION_COMBO | queued |
| 5 | 2.3.5 | ORG_UNIT_SCOPE | queued |
| 6 | 2.3.6 | RELATIONSHIP | queued |
| 7 | 2.3.7 | EVENT_INSTANCE | queued |
| 8 | 2.3.8 | DATASET_ELEMENT | queued |
| 9 | 2.3.9 | PERIOD_SCOPE | queued |

## Build + test

```
tsc -b && vite build                      ✓ 90 modules
./mvnw -q -DskipTests clean package       ✓ 2.3.1 JAR + V046 applied
E2E Playwright sweep                      ✓ allowed-on-PROGRAM + 2× rejection, 0 pageerrors
```
