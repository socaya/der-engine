# der-2.3.4 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.3`

## Headline

**Workflow section kind 4/9 — `ATTRIBUTE_OPTION_COMBO`.** The
funder / project / donor split, cross-cutting over every parent
binding. One person captures the GAVI-funded slice of a dataset,
another captures the World-Bank-funded slice, and the compiler
stamps every contributed `dataValue` (aggregate) or `event`
(program) with that AOC UID so DHIS2 processes them as distinct
value populations.

## 1. Schema (V049)

```sql
der.capture_workflow_step
  CHECK section_kind IN (
      'DATASET_SECTION','PROGRAM_STAGE','PROGRAM_STAGE_SECTION',
      'TEI_ATTRIBUTE_GROUP','DATA_ELEMENT_GROUP','COC_SPLIT',
      'ENROLLMENT_FORM','PROGRAM_SECTION','TEI_TYPE_ATTRIBUTES',
      'ATTRIBUTE_OPTION_COMBO',   -- V049
      'AD_HOC')
```

## 2. Validation matrix

Cross-cutting fast path in `sectionKindCompatible()`:

```java
if (section == ATTRIBUTE_OPTION_COMBO) return true;
```

Accepted under **DATA_SET**, **PROGRAM**, **PROGRAM_STAGE**, and
**PROGRAM_STAGE_SECTION**. The step's `sectionRef` is the DHIS2
AttributeOptionCombo UID.

## 3. Compiler — AOC stamping

### Aggregate (DATA_SET)

Merge key changed from `(dataElement, categoryOptionCombo)` to
`(dataElement, categoryOptionCombo, attributeOptionCombo)`. Each
dataValue contributed by an ATTRIBUTE_OPTION_COMBO step gets the
step's `sectionRef` stamped into its `attributeOptionCombo` field (if
not already set).

Result: one dataset can carry parallel funder populations:

```json
{
  "dataValues": [
    { "dataElement": "DE1", "categoryOptionCombo": "COC1",
      "attributeOptionCombo": "aoc-GAVI", "value": "10" },
    { "dataElement": "DE1", "categoryOptionCombo": "COC1",
      "attributeOptionCombo": "aoc-WB",   "value": "20" }
  ]
}
```

### Events (PROGRAM / stage / section)

Event dedup key changed from `(programStage, occurredAt)` to
`(programStage, occurredAt, attributeOptionCombo)`. AOC step's
events get stamped before dedup, so events for the same stage +
timestamp but different funders stay distinct.

### Enrollments (PROGRAM)

AOC step payload with any enrollment-level fields
(`enrollmentDate`, `enrollment`, …) also sets
`enrollment.attributeOptionCombo`.

## 4. Verified live

```
POST /workflows with ATTRIBUTE_OPTION_COMBO step under…
  DATA_SET                → 200 OK ✓
  PROGRAM                 → 200 OK ✓
  PROGRAM_STAGE           → 200 OK ✓
  PROGRAM_STAGE_SECTION   → 200 OK ✓

WorkflowCompilerTest: Tests run: 7, Failures: 0 ✓
  - aggregate (DE, CoC) merge
  - event within-event field merge
  - tracker enrollment fold
  - program section attribute merge
  - tei type attributes trackedEntity block
  - aggregate AOC stamp (new) — two steps on same (DE, CoC) emit
    two rows with distinct AOCs
  - event AOC stamp (new) — event carries AOC on compiled output
```

## 5. Progress on the 9-kind march

| # | Release | Kind | Status |
|---|---|---|---|
| 1 | 2.3.1 | ENROLLMENT_FORM | ✓ |
| 2 | 2.3.2 | PROGRAM_SECTION | ✓ |
| 3 | 2.3.3 | TEI_TYPE_ATTRIBUTES | ✓ |
| 4 | **2.3.4** | **ATTRIBUTE_OPTION_COMBO** | **✓ shipped** |
| 5 | 2.3.5 | ORG_UNIT_SCOPE | queued |
| 6 | 2.3.6 | RELATIONSHIP | queued |
| 7 | 2.3.7 | EVENT_INSTANCE | queued |
| 8 | 2.3.8 | DATASET_ELEMENT | queued |
| 9 | 2.3.9 | PERIOD_SCOPE | queued |

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.4 JAR + V049 applied
WorkflowCompilerTest                       ✓ 7/7
E2E Playwright sweep                       ✓ 4× binding × 1 AOC step all 200
```
