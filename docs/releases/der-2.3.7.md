# der-2.3.7 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.6`

## Headline

**Workflow section kind 7/9 — `EVENT_INSTANCE`.** A single event
occurrence within a repeating program stage. For an ANC program
with the ANC_VISIT stage, ANC1 / ANC2 / ANC3 / ANC4 are four
EVENT_INSTANCE candidates captured (potentially) by different people.
`sectionRef` is the DHIS2 event UID; compiler stamps it onto events
and dedupes by UID so parallel steps can split capture across one
event's fields.

## 1. Schema (V052)

```sql
der.capture_workflow_step
  CHECK section_kind IN (
      …,
      'EVENT_INSTANCE',   -- V052
      'AD_HOC')
```

## 2. Validation matrix

Valid under **PROGRAM**, **PROGRAM_STAGE**, and
**PROGRAM_STAGE_SECTION**. Rejected on DATA_SET.

## 3. Compiler — event-UID dedupe

The event compilation path now:

1. Stamps `event` field with step's `sectionRef` when
   `sectionKind == EVENT_INSTANCE` and the payload doesn't carry an
   explicit event UID.
2. Promotes the event UID to the primary dedupe key when present:
   ```java
   final String key = !uid.isBlank()
       ? "event:" + uid
       : programStage + "|" + occurredAt + "|" + AOC + "|" + OU;
   ```
3. When two EVENT_INSTANCE steps target the SAME event UID, their
   `dataValues[]` merge via `mergeEventFields()` — exactly like the
   within-event field-level merge from 2.3.1.

Result: one event can be captured by multiple people in parallel
without data loss.

## 4. Verified live

```
POST /workflows with EVENT_INSTANCE step under…
  PROGRAM                 → 200 OK ✓
  PROGRAM_STAGE           → 200 OK ✓
  PROGRAM_STAGE_SECTION   → 200 OK ✓
  DATA_SET                → 400 SECTION_KIND_INVALID ✓

WorkflowCompilerTest: Tests run: 12, Failures: 0 ✓
  + eventInstanceStampsUidAndMergesByUid — two EVENT_INSTANCE steps
    on same event UID merge dataValues (BP + TEMP) into one event
  + twoEventInstancesStayDistinct — two EVENT_INSTANCE steps on
    different event UIDs stay as 2 distinct events
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
| 7 | **2.3.7** | **EVENT_INSTANCE** | **✓ shipped** |
| 8 | 2.3.8 | DATASET_ELEMENT | queued |
| 9 | 2.3.9 | PERIOD_SCOPE | queued |

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.7 JAR + V052 applied
WorkflowCompilerTest                       ✓ 12/12
E2E Playwright sweep                       ✓ 3× allow + 1× reject
```
