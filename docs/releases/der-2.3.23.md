# der-2.3.23 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.22`

## Headline

**`PROGRAM_STAGE_SECTION` splitting lands in the wizard tracker
flow.** When a program stage has program-stage-sections in the
metadata mirror, the wizard renders them as indented sub-rows under
their parent stage. The operator picks either the whole stage
(`PROGRAM_STAGE`) or specific sections of it (`PROGRAM_STAGE_SECTION`),
with mutual-exclusion so a stage and its sections can't both be
captured by the same workflow.

## 1. Metadata plumbing

### Wizard-side

`listProgramStages(programId)` now also makes one batched
`GET /api/programStageSections?paging=false&fields=id,displayName,programStage`,
groups the sections by `programStage.id`, and interleaves them under
their stage in the returned breakable list — one network round-trip
regardless of stage count.

Each section breakable carries:

```typescript
{ id: '<section uid>', displayName: 'Clinical examination',
  sectionKind: 'PROGRAM_STAGE_SECTION',
  parentId: '<parent stage uid>' }
```

### Server-side

```
GET /edge-api/v1/metadata/field-candidates?kind=PROGRAM_STAGE_SECTION&ref=X
```

Walks `metadata_catalog_item` where `resource='programStageSections'`
for `dhis2_uid=X`, extracts `payload.dataElements[].id/displayName`.
Falls back to the parent stage's data elements if the section payload
doesn't carry an explicit element list (common for DHIS2 instances
that keep elements only on the parent stage).

## 2. UI — step 3 tree

- Sub-rows render with:
  - A row-level `.is-nested` class on the row,
  - A ↳ marker + 32 px left padding on the section label,
  - A muted left strip on the include + expand cells so the parent
    stage still reads as the grouping anchor.
- **Mutual-exclusion.** Ticking the parent stage auto-unticks its
  section rows; ticking any section auto-unticks the parent. Prevents
  double-capture of the same data in one workflow.
- The field-level selector (2.3.22) works at section granularity too
  — expanding a section fetches `/field-candidates?kind=
  PROGRAM_STAGE_SECTION`, operator ticks the data elements the
  section captures and marks REQUIRED / OPTIONAL per field.

## 3. Compat

- `isWizardCompatible(w)` now treats `PROGRAM_STAGE_SECTION` as a
  wizard-compatible section kind, so existing workflows that already
  use it (e.g. authored via the technical designer) open in the
  guided wizard too.
- Workflows without `PROGRAM_STAGE_SECTION` behave exactly as before:
  no visible UI change, zero extra network traffic (the batched
  sections call returns an empty list and the renderer skips the
  nested branch).

## 4. Verified live

```
Phase A  GET /field-candidates?kind=PROGRAM_STAGE_SECTION       ✓ 0 fields on
         (no sections mirrored in test DHIS2)                    unknown ref

Phase B  tracker wizard — HIV Pro Patient Identity Registry     ✓ 50 stage rows
                                                                  0 nested (expected —
                                                                  no sections in mirror)

Phase C  pick stage, save                                       ✓ sectionKind=PROGRAM_STAGE
                                                                  ref=<stage uid>
                                                                  (unchanged behaviour)
pageerrors                                                      ✓ 0
```

The local DHIS2 2.44 metadata set has no `programStageSections` rows,
so the behavioural proof is "no regression against the 2.3.22 flow".
A pilot facility that uses stage sections will see them appear
automatically — the plumbing is wired end-to-end.

## 5. Files changed

```
admin-ui/src/screens/workflow/wizardMetadata.ts            — Breakable.parentId,
                                                             PROGRAM_STAGE_SECTION,
                                                             listSectionsForStages()
                                                             (batched), compat guard
admin-ui/src/screens/workflow/WorkflowWizard.tsx           — tree render + stage ↔
                                                             section mutual-exclusion
admin-ui/src/styles.css                                    — tr.is-nested backdrop
server/.../web/MetadataFieldCandidatesController.java      — PROGRAM_STAGE_SECTION branch
                                                             walks catalog payload + parent
                                                             stage fallback
VERSION / server/pom.xml / admin-ui/package.json / sw.js   — 2.3.23
```

## 6. Build + test

```
tsc -b && vite build                 ✓
mvn -q -DskipTests package           ✓ 2.3.23 JAR
End-to-end: no regressions           ✓ tracker flow with stageSection plumbing
                                       behaves identically for metadata without
                                       sections (expected)
```

## 7. Follow-up

Live validation at scale requires a DHIS2 instance that actually
publishes `programStageSections` for its tracker programs. The pilot
instance did not have any at the time of this release; once a
facility turns them on they will light up in the wizard without a
further release.
