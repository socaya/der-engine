# der-2.3.8 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.7`

## Headline

**Workflow section kind 8/9 — `DATASET_ELEMENT`.** Captures ONE
specific DataSet element row (the `dataElement` + optional
categoryCombo override declared on `DataSet.dataSetElements[]`). A
step owns a single DE across all its disaggregation rows — useful
when a high-stakes indicator needs a dedicated capture
responsibility.

## 1. Schema (V053)

```sql
der.capture_workflow_step
  CHECK section_kind IN (
      …,
      'DATASET_ELEMENT',   -- V053
      'AD_HOC')
```

## 2. Validation matrix

| Binding | Added |
|---|---|
| **DATA_SET** | **DATASET_ELEMENT** (joins DATASET_SECTION / DATA_ELEMENT_GROUP / COC_SPLIT) |

Rejected on PROGRAM / PROGRAM_STAGE / PROGRAM_STAGE_SECTION.

## 3. Compiler — DE stamp on dataValues

`compileDataSet()` now also stamps `dataElement` on each contributed
dataValue when `sectionKind == DATASET_ELEMENT` and the row doesn't
already set one:

```java
final String deStamp = s.sectionKind()
        == SectionKind.DATASET_ELEMENT ? s.sectionRef() : null;
if (deStamp != null && !deStamp.isBlank() && noDE(value)) {
    value.put("dataElement", deStamp);
}
```

The merge key stays `(DE, CoC, AOC, OU)` — the stamp just populates
the DE slot. Payloads can therefore carry only `categoryOptionCombo`
+ `value` per row:

```json
{
  "dataValues": [
    { "categoryOptionCombo": "COC_MALE",   "value": "5" },
    { "categoryOptionCombo": "COC_FEMALE", "value": "7" }
  ]
}
```

→ compiled to

```json
{
  "dataValues": [
    { "dataElement": "DE_ANC_VISITS", "categoryOptionCombo": "COC_MALE",   "value": "5" },
    { "dataElement": "DE_ANC_VISITS", "categoryOptionCombo": "COC_FEMALE", "value": "7" }
  ]
}
```

## 4. Verified live

```
POST /workflows with DATA_SET + DATASET_ELEMENT step     → 200 OK ✓
POST /workflows with PROGRAM + DATASET_ELEMENT           → 400 SECTION_KIND_INVALID ✓
POST /workflows with PROGRAM_STAGE + DATASET_ELEMENT     → 400 SECTION_KIND_INVALID ✓
POST /workflows with PROGRAM_STAGE_SECTION + DATASET_ELEMENT → 400 SECTION_KIND_INVALID ✓

WorkflowCompilerTest: Tests run: 13, Failures: 0 ✓
  + aggregateDatasetElementStampsDataElement — payload with only
    CoC + value rows; compiled output has dataElement=DE_ANC_VISITS
    stamped on every row
```

## 5. Progress on the 9-kind march

| # | Release | Kind | Status |
|---|---|---|---|
| 1 | 2.3.1 | ENROLLMENT_FORM | ✓ |
| 2 | 2.3.2 | PROGRAM_SECTION | ✓ |
| 3 | 2.3.3 | TEI_TYPE_ATTRIBUTES | ✓ |
| 4 | 2.3.4 | ATTRIBUTE_OPTION_COMBO | ✓ |
| 5 | 2.3.5 | ORG_UNIT_SCOPE | ✓ |
| 6 | 2.3.6 | RELATIONSHIP | ✓ |
| 7 | 2.3.7 | EVENT_INSTANCE | ✓ |
| 8 | **2.3.8** | **DATASET_ELEMENT** | **✓ shipped** |
| 9 | 2.3.9 | PERIOD_SCOPE | queued |

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.8 JAR + V053 applied
WorkflowCompilerTest                       ✓ 13/13
E2E Playwright sweep                       ✓ 1× allow + 3× reject
```
