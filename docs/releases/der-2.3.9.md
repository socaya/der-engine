# der-2.3.9 (stable) — 9-kind march complete

**Date:** 2026-10-31
**Previous stable:** `der-2.3.8`

## Headline

**Workflow section kind 9/9 — `PERIOD_SCOPE`.** Period / time split
for aggregate datasets — one person captures Q1 2026, another
captures Q2 2026 for the same dataset. Common in historical backfill
scenarios where capture responsibility is split by reporting period.

**This release completes the 9-kind march** — DER workflows now
support every DHIS2 v41+ breakable-section distribution point across
aggregate, event, and tracker domains.

## 1. Schema (V054)

```sql
der.capture_workflow_step
  CHECK section_kind IN (
      …,
      'PERIOD_SCOPE',    -- V054
      'AD_HOC')
```

## 2. Validation matrix

| Binding | Added |
|---|---|
| **DATA_SET** | **PERIOD_SCOPE** (joins DATASET_SECTION / DE_GROUP / COC_SPLIT / DATASET_ELEMENT) |

Rejected on PROGRAM / PROGRAM_STAGE / PROGRAM_STAGE_SECTION.
(Programs carry per-event `occurredAt` timestamps rather than
period strings.)

## 3. Compiler — period stamp + dedup

`compileDataSet()` now also stamps `period` from `sectionRef` on each
contributed dataValue when `sectionKind == PERIOD_SCOPE`, and extends
the dedup key to include period:

```java
final String key = DE + "|" + CoC + "|" + AOC + "|" + OU + "|" + period;
```

Result: Q1 and Q2 slices of the same `(DE, CoC)` cell stay as two
distinct rows on the compiled submission.

## 4. Verified live

```
POST /workflows with DATA_SET + PERIOD_SCOPE step        → 200 OK ✓
POST /workflows with PROGRAM + PERIOD_SCOPE              → 400 SECTION_KIND_INVALID ✓
POST /workflows with PROGRAM_STAGE + PERIOD_SCOPE        → 400 SECTION_KIND_INVALID ✓
POST /workflows with PROGRAM_STAGE_SECTION + PERIOD_SCOPE → 400 SECTION_KIND_INVALID ✓

WorkflowCompilerTest: Tests run: 14, Failures: 0 ✓
  + aggregatePeriodScopeStampsPeriodAndKeepsSlicesDistinct — two
    PERIOD_SCOPE steps on same (DE, CoC) with sectionRef=2026Q1
    and 2026Q2 produce 2 distinct dataValues, each stamped with
    its period
```

## 5. The complete 9-kind march — shipped

| # | Release | Section Kind | Binding | What it captures |
|---|---|---|---|---|
| 1 | 2.3.1 | `ENROLLMENT_FORM` | PROGRAM | Enrollment date / status / orgUnit + enrollment attributes |
| 2 | 2.3.2 | `PROGRAM_SECTION` | PROGRAM | DHIS2 v2.30+ ProgramSection (grouped TEI attrs on enrol form) |
| 3 | 2.3.3 | `TEI_TYPE_ATTRIBUTES` | PROGRAM | TrackedEntityType profile (name / DoB / sex) |
| 4 | 2.3.4 | `ATTRIBUTE_OPTION_COMBO` | all 4 | Funder / project / donor split (AOC) |
| 5 | 2.3.5 | `ORG_UNIT_SCOPE` | all 4 | Sub-OU split (district edge, hospital wards) |
| 6 | 2.3.6 | `RELATIONSHIP` | PROGRAM | Mother ↔ child, index ↔ contact TEI links |
| 7 | 2.3.7 | `EVENT_INSTANCE` | PROGRAM / stage / section | Specific event in a repeating stage (ANC1, ANC2) |
| 8 | 2.3.8 | `DATASET_ELEMENT` | DATA_SET | One specific DE on a DataSet |
| 9 | **2.3.9** | **`PERIOD_SCOPE`** | DATA_SET | Period / time split |

Together with the pre-march kinds — `DATASET_SECTION`,
`PROGRAM_STAGE`, `PROGRAM_STAGE_SECTION`, `TEI_ATTRIBUTE_GROUP`,
`DATA_ELEMENT_GROUP`, `COC_SPLIT`, `AD_HOC` — DER now covers **16
section kinds** across every DHIS2 v41+ data-collection split
operators would want.

## 6. Compiler coverage (14 tests)

```
aggregateMergesDataValuesByDeCoc                               (2.3.0)
eventFieldLevelSplitMergesWithinEvent                          (2.3.1)
trackerEnrollmentFoldedIntoEnrollmentBlock                     (2.3.1)
programSectionAttributesMergeIntoAttributesArray               (2.3.2)
teiTypeAttributesFoldedIntoTrackedEntityBlock                  (2.3.3)
aggregateAttributeOptionComboStampedOnDataValues               (2.3.4)
eventAttributeOptionComboStampedOnEvents                       (2.3.4)
aggregateOrgUnitScopeStampedOnDataValues                       (2.3.5)
eventOrgUnitScopeStampedOnEvents                               (2.3.5)
relationshipsFoldedIntoDedicatedBlock                          (2.3.6)
eventInstanceStampsUidAndMergesByUid                           (2.3.7)
twoEventInstancesStayDistinct                                  (2.3.7)
aggregateDatasetElementStampsDataElement                       (2.3.8)
aggregatePeriodScopeStampsPeriodAndKeepsSlicesDistinct         (2.3.9)
```

## 7. What's next

- **2.3.10** — row-menu polish (Enable/Disable, Duplicate, Export,
  View runs) + reject-reason UI improvements
- **2.3.11** — run drilldown page `/workflows/runs/:runId` with
  per-step contribution table
- **2.3.12** — designer validation (JSON parse pre-submit, step
  ordinal checks, DAG acyclicity)
- **2.3.13** — form-based designer with section pickers + device
  pickers replacing the raw JSON textarea

The breakable-section model is complete; everything after this is
designer UX and operational tooling on top.

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.9 JAR + V054 applied
WorkflowCompilerTest                       ✓ 14/14
E2E Playwright sweep                       ✓ 1× allow + 3× reject
```
