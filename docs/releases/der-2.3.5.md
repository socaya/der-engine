# der-2.3.5 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.4`

## Headline

**Workflow section kind 5/9 — `ORG_UNIT_SCOPE`.** Sub-OU split for
edges that serve more than one org unit — district edges collecting
per-facility slices, hospital edges with ward-level sub-OUs, OU-group
splits. Cross-cutting across every parent binding, same semantics as
V049 AOC.

## 1. Scope — when this applies

DER is typically bound to one org unit (a facility). ORG_UNIT_SCOPE
is only useful when the edge has **sub-OUs below** its own binding
level:

- **District edges** — one DER serves N health centres; each step
  binds to a facility UID below the district
- **Hospital edges** — ward-level sub-OUs (OPD / maternity / lab)
- **OU groups** — ad-hoc groupings (coastal / inland facilities) for
  aggregated reporting

For a plain single-OU facility edge the step is still accepted but
the orgUnit stamp is just a redundant annotation. No harm.

## 2. Schema (V050)

```sql
der.capture_workflow_step
  CHECK section_kind IN (
      'DATASET_SECTION','PROGRAM_STAGE','PROGRAM_STAGE_SECTION',
      'TEI_ATTRIBUTE_GROUP','DATA_ELEMENT_GROUP','COC_SPLIT',
      'ENROLLMENT_FORM','PROGRAM_SECTION','TEI_TYPE_ATTRIBUTES',
      'ATTRIBUTE_OPTION_COMBO',
      'ORG_UNIT_SCOPE',       -- V050
      'AD_HOC')
```

## 3. Validation matrix

Cross-cutting fast-path now accepts both AOC and OU:

```java
if (section == ATTRIBUTE_OPTION_COMBO || section == ORG_UNIT_SCOPE) {
    return true;
}
```

Legal under **DATA_SET**, **PROGRAM**, **PROGRAM_STAGE**, and
**PROGRAM_STAGE_SECTION**.

## 4. Compiler — orgUnit stamping

### Aggregate (DATA_SET)

Merge key extended to
`(dataElement, categoryOptionCombo, attributeOptionCombo, orgUnit)`.
ORG_UNIT_SCOPE step's `sectionRef` is stamped as `orgUnit` on each
dataValue (unless already set):

```json
{
  "dataValues": [
    { "dataElement": "DE1", "categoryOptionCombo": "COC1",
      "orgUnit": "ou-facility-A", "value": "10" },
    { "dataElement": "DE1", "categoryOptionCombo": "COC1",
      "orgUnit": "ou-facility-B", "value": "7" }
  ]
}
```

### Events (PROGRAM / stage / section)

Event dedup key extended to
`(programStage, occurredAt, attributeOptionCombo, orgUnit)`. ORG_UNIT_SCOPE
step stamps `orgUnit` on each event before merge.

### Enrollments (PROGRAM)

ORG_UNIT_SCOPE step payload with enrollment-level fields also sets
`enrollment.orgUnit`.

## 5. Verified live

```
POST /workflows with ORG_UNIT_SCOPE step under…
  DATA_SET                → 200 OK ✓
  PROGRAM                 → 200 OK ✓
  PROGRAM_STAGE           → 200 OK ✓
  PROGRAM_STAGE_SECTION   → 200 OK ✓

WorkflowCompilerTest: Tests run: 9, Failures: 0 ✓
  + aggregateOrgUnitScopeStampedOnDataValues
  + eventOrgUnitScopeStampedOnEvents
```

## 6. Progress on the 9-kind march

| # | Release | Kind | Status |
|---|---|---|---|
| 1 | 2.3.1 | ENROLLMENT_FORM | ✓ |
| 2 | 2.3.2 | PROGRAM_SECTION | ✓ |
| 3 | 2.3.3 | TEI_TYPE_ATTRIBUTES | ✓ |
| 4 | 2.3.4 | ATTRIBUTE_OPTION_COMBO | ✓ |
| 5 | **2.3.5** | **ORG_UNIT_SCOPE** | **✓ shipped** |
| 6 | 2.3.6 | RELATIONSHIP | queued |
| 7 | 2.3.7 | EVENT_INSTANCE | queued |
| 8 | 2.3.8 | DATASET_ELEMENT | queued |
| 9 | 2.3.9 | PERIOD_SCOPE | queued |

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.5 JAR + V050 applied
WorkflowCompilerTest                       ✓ 9/9
E2E Playwright sweep                       ✓ 4× binding × 1 OU step all 200
```
