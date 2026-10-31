# der-2.3.2 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.1`

## Headline

**Workflow section kind 2/9 — `PROGRAM_SECTION`.** DHIS2 v2.30+
introduced `ProgramSection` metadata — a named grouping of
tracked-entity attributes rendered as a section of the enrollment
form. A workflow step with `sectionKind: PROGRAM_SECTION` captures
only the attributes DHIS2 declares on that section
(`programSection.trackedEntityAttributes`), and the compiler merges
them into the compiled enrollment form.

## 1. Schema (V047)

```sql
der.capture_workflow_step
  CHECK section_kind IN (
      'DATASET_SECTION','PROGRAM_STAGE','PROGRAM_STAGE_SECTION',
      'TEI_ATTRIBUTE_GROUP','DATA_ELEMENT_GROUP','COC_SPLIT',
      'ENROLLMENT_FORM',
      'PROGRAM_SECTION',    -- V047
      'AD_HOC')
```

## 2. Validation matrix

| Binding | Added |
|---|---|
| **PROGRAM** | **PROGRAM_SECTION** (joins ENROLLMENT_FORM / PROGRAM_STAGE / etc.) |

Still rejected on DATA_SET / PROGRAM_STAGE / PROGRAM_STAGE_SECTION.

## 3. Compiler

`PROGRAM_SECTION` contributes `attributes[]` — the existing
`compileProgram()` merge path keys by attribute UID and preserves
section-provenance implicitly. No new compiler code required; new
test case `programSectionAttributesMergeIntoAttributesArray` locks the
behaviour in.

## 4. Verified live

```
POST /workflows with PROGRAM binding + PROGRAM_SECTION step
  → 200 OK; stored sectionKind=PROGRAM_SECTION
    sectionRef=section-demographics-uid ✓

POST /workflows with DATA_SET + PROGRAM_SECTION step
  → 400 SECTION_KIND_INVALID ✓

POST /workflows with PROGRAM_STAGE + PROGRAM_SECTION step
  → 400 SECTION_KIND_INVALID ✓

WorkflowCompilerTest: Tests run: 4, Failures: 0 ✓
```

## 5. Progress on the 9-kind march

| # | Release | Kind | Status |
|---|---|---|---|
| 1 | 2.3.1 | ENROLLMENT_FORM | ✓ |
| 2 | **2.3.2** | **PROGRAM_SECTION** | **✓ shipped** |
| 3 | 2.3.3 | TEI_TYPE_ATTRIBUTES | queued |
| 4 | 2.3.4 | ATTRIBUTE_OPTION_COMBO | queued |
| 5 | 2.3.5 | ORG_UNIT_SCOPE | queued |
| 6 | 2.3.6 | RELATIONSHIP | queued |
| 7 | 2.3.7 | EVENT_INSTANCE | queued |
| 8 | 2.3.8 | DATASET_ELEMENT | queued |
| 9 | 2.3.9 | PERIOD_SCOPE | queued |

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.2 JAR + V047 applied
WorkflowCompilerTest                       ✓ 4/4
E2E Playwright sweep                       ✓ 1× allow + 2× rejection
```
