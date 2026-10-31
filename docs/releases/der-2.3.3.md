# der-2.3.3 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.2`

## Headline

**Workflow section kind 3/9 — `TEI_TYPE_ATTRIBUTES`.** Captures the
cross-program profile fields (name, DoB, sex, national ID) that live
on `TrackedEntityType.trackedEntityTypeAttributes` — the attributes
the tracker API expects at `trackedEntity.attributes[]`, distinct
from enrollment-level attributes.

A workflow can now split tracker capture across:
- a profile step (`TEI_TYPE_ATTRIBUTES`) — one person captures the TEI
  identity
- an enrollment step (`ENROLLMENT_FORM`) — another person records
  dates / org unit / status
- program-section steps (`PROGRAM_SECTION`) — form sections filled in
  by role-specific operators
- stage steps (`PROGRAM_STAGE` / `PROGRAM_STAGE_SECTION`) — clinical
  visits captured per event

…and the compiler assembles the DHIS2 tracker payload with the right
blocks.

## 1. Schema (V048)

```sql
der.capture_workflow_step
  CHECK section_kind IN (
      'DATASET_SECTION','PROGRAM_STAGE','PROGRAM_STAGE_SECTION',
      'TEI_ATTRIBUTE_GROUP','DATA_ELEMENT_GROUP','COC_SPLIT',
      'ENROLLMENT_FORM','PROGRAM_SECTION',
      'TEI_TYPE_ATTRIBUTES',   -- V048
      'AD_HOC')
```

## 2. Validation matrix

`PROGRAM` binding now accepts: `PROGRAM_STAGE`, `PROGRAM_STAGE_SECTION`,
`TEI_ATTRIBUTE_GROUP`, `DATA_ELEMENT_GROUP`, `ENROLLMENT_FORM`,
`PROGRAM_SECTION`, **`TEI_TYPE_ATTRIBUTES`**, `AD_HOC`.

Rejected on `DATA_SET` / `PROGRAM_STAGE` / `PROGRAM_STAGE_SECTION`.

## 3. Compiler — trackedEntity block

`compileProgram()` tracks TEI-level data in a dedicated bucket and
emits a `trackedEntity` root node:

```json
{
  "workflowId": "…",
  "boundMetadataKind": "PROGRAM",
  "program": "ANC001",
  "trackedEntity": {               // ← new in V048
    "trackedEntityType": "PERSON",
    "orgUnit": "OU-123",
    "geometry": { ... },
    "attributes": [
      { "attribute": "NAME", "value": "Mary" },
      { "attribute": "DOB",  "value": "1990-01-01" }
    ]
  },
  "enrollment": { "attributes": [ ... ] },  // ENROLLMENT_FORM
  "attributes": [ ... ],                     // enrollment-level attrs
  "events": [ ... ]
}
```

Later TEI_TYPE_ATTRIBUTES steps overwrite earlier values keyed by
attribute UID. Enrollment-level attribute arrays are untouched.

## 4. Verified live

```
POST /workflows with PROGRAM + TEI_TYPE_ATTRIBUTES step
  → 200 OK; sectionRef=teType-person stored ✓

POST /workflows with DATA_SET + TEI_TYPE_ATTRIBUTES step
  → 400 SECTION_KIND_INVALID ✓

POST /workflows with PROGRAM_STAGE + TEI_TYPE_ATTRIBUTES step
  → 400 SECTION_KIND_INVALID ✓

WorkflowCompilerTest: Tests run: 5, Failures: 0 ✓
  - aggregate dataValues merge
  - event within-event field merge
  - tracker enrollment fold
  - program section attribute merge
  - tei type attributes trackedEntity block (new)
```

## 5. Progress on the 9-kind march

| # | Release | Kind | Status |
|---|---|---|---|
| 1 | 2.3.1 | ENROLLMENT_FORM | ✓ |
| 2 | 2.3.2 | PROGRAM_SECTION | ✓ |
| 3 | **2.3.3** | **TEI_TYPE_ATTRIBUTES** | **✓ shipped** |
| 4 | 2.3.4 | ATTRIBUTE_OPTION_COMBO | queued |
| 5 | 2.3.5 | ORG_UNIT_SCOPE | queued |
| 6 | 2.3.6 | RELATIONSHIP | queued |
| 7 | 2.3.7 | EVENT_INSTANCE | queued |
| 8 | 2.3.8 | DATASET_ELEMENT | queued |
| 9 | 2.3.9 | PERIOD_SCOPE | queued |

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.3 JAR + V048 applied
WorkflowCompilerTest                       ✓ 5/5
E2E Playwright sweep                       ✓ 1× allow + 2× rejection
```
