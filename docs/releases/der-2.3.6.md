# der-2.3.6 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.5`

## Headline

**Workflow section kind 6/9 — `RELATIONSHIP`.** Tracker TEI linking:
mother ↔ child, index case ↔ contact, caregiver ↔ patient, household
head ↔ member. `sectionRef` is the DHIS2 `RelationshipType` UID; the
compiler folds each payload's `relationships[]` into a dedicated
top-level block on the compiled tracker submission.

## 1. Schema (V051)

```sql
der.capture_workflow_step
  CHECK section_kind IN (
      …,
      'RELATIONSHIP',   -- V051
      'AD_HOC')
```

## 2. Validation matrix

PROGRAM binding only (relationships are tracker-only metadata).

Rejected on DATA_SET / PROGRAM_STAGE / PROGRAM_STAGE_SECTION.

## 3. Compiler — relationships block

New `mergeRelationships()` helper:

- Dedupe key = `(fromEndpoint, toEndpoint, relationshipType)`.
- Endpoint flattened to `trackedEntity:<uid>` or `enrollment:<uid>` or
  `event:<uid>` (whichever is present on the endpoint object).
- `relationshipType` on each relationship defaults from the step's
  `sectionRef` when the payload itself doesn't set it.
- Relationship step payload goes **only** to `relationships[]` — not
  to `attributes[]` / `events[]`.

Compiled output:

```json
{
  "trackedEntity": { … },
  "enrollment": { … },
  "events": [ … ],
  "relationships": [
    { "from": {"trackedEntity":"TE-INDEX-1"},
      "to":   {"trackedEntity":"TE-CONTACT-1"},
      "relationshipType": "RT-INDEX-CONTACT" }
  ],
  "attributes": [ … ]
}
```

## 4. Verified live

```
POST /workflows with PROGRAM + RELATIONSHIP step  → 200 OK ✓
POST /workflows with DATA_SET + RELATIONSHIP      → 400 SECTION_KIND_INVALID ✓
POST /workflows with PROGRAM_STAGE + RELATIONSHIP → 400 SECTION_KIND_INVALID ✓
POST /workflows with PROGRAM_STAGE_SECTION + RELATIONSHIP → 400 SECTION_KIND_INVALID ✓

WorkflowCompilerTest: Tests run: 10, Failures: 0 ✓
  + relationshipsFoldedIntoDedicatedBlock — proves default from sectionRef
    stamped on relationships[0], explicit relationshipType preserved on
    relationships[1]
```

## 5. Progress on the 9-kind march

| # | Release | Kind | Status |
|---|---|---|---|
| 1 | 2.3.1 | ENROLLMENT_FORM | ✓ |
| 2 | 2.3.2 | PROGRAM_SECTION | ✓ |
| 3 | 2.3.3 | TEI_TYPE_ATTRIBUTES | ✓ |
| 4 | 2.3.4 | ATTRIBUTE_OPTION_COMBO | ✓ |
| 5 | 2.3.5 | ORG_UNIT_SCOPE | ✓ |
| 6 | **2.3.6** | **RELATIONSHIP** | **✓ shipped** |
| 7 | 2.3.7 | EVENT_INSTANCE | queued |
| 8 | 2.3.8 | DATASET_ELEMENT | queued |
| 9 | 2.3.9 | PERIOD_SCOPE | queued |

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.6 JAR + V051 applied
WorkflowCompilerTest                       ✓ 10/10
E2E Playwright sweep                       ✓ 1× allow + 3× reject
```
