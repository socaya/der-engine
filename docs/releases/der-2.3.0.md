# der-2.3.0 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.2.11`

## Headline

**Workflows are now breakable sections.** A workflow in DER is a
data-collection unit (dataset / program / program-stage /
program-stage-section) broken into one or more sections, each section
assigned to a specific user+device for capture, compiled back into a
single submission, optionally gated by approval.

This is the domain refactor; the visual designer + row-menu polish are
2.3.1–2.3.3.

## 1. Schema (V045)

```sql
der.capture_workflow
  + requires_approval  boolean NOT NULL DEFAULT false
  + default_device_id  uuid REFERENCES edge_device ON DELETE SET NULL
  bound_metadata_kind  CHECK now accepts PROGRAM_STAGE_SECTION

der.capture_workflow_step
  + section_kind       NOT NULL DEFAULT 'AD_HOC'
  + section_ref        text
  CHECK section_kind IN
      ('DATASET_SECTION','PROGRAM_STAGE','PROGRAM_STAGE_SECTION',
       'TEI_ATTRIBUTE_GROUP','DATA_ELEMENT_GROUP','COC_SPLIT','AD_HOC')
```

Index on `(section_kind, section_ref)` for cross-workflow lookups.

## 2. Domain model

- `CaptureWorkflow` record gains `requiresApproval` + `defaultDeviceId`.
- `CaptureWorkflow.BindingKind` adds `PROGRAM_STAGE_SECTION`.
- `CaptureWorkflowStep` record gains `sectionKind` + `sectionRef`.
- New `CaptureWorkflowStep.SectionKind` enum with 7 values covering
  every breakable slice of DHIS2 data collection.

## 3. Server-side validation

`CaptureWorkflowController.save()` now rejects workflows whose steps
declare a `sectionKind` incompatible with the chosen
`boundMetadataKind`:

| Binding | Allowed step section kinds |
|---|---|
| `DATA_SET` | `DATASET_SECTION`, `DATA_ELEMENT_GROUP`, `COC_SPLIT`, `AD_HOC` |
| `PROGRAM` | `PROGRAM_STAGE`, `PROGRAM_STAGE_SECTION`, `TEI_ATTRIBUTE_GROUP`, `DATA_ELEMENT_GROUP`, `AD_HOC` |
| `PROGRAM_STAGE` | `PROGRAM_STAGE_SECTION`, `DATA_ELEMENT_GROUP`, `AD_HOC` |
| `PROGRAM_STAGE_SECTION` | `DATA_ELEMENT_GROUP`, `AD_HOC` |

Returns `400 SECTION_KIND_INVALID` with a precise message naming the
offending step.

## 4. WorkflowCompiler service

New `WorkflowCompiler` merges all step contributions back into one
DHIS2-ready payload:

- **DATA_SET** — merges `dataValues[]` by
  `(dataElement, categoryOptionCombo)`; later steps overwrite earlier
  values when the same cell is submitted twice.
- **PROGRAM / PROGRAM_STAGE / PROGRAM_STAGE_SECTION** — unions
  `attributes[]` keyed by attribute UID; unions `events[]` keyed by
  `(programStage, occurredAt)`.

Returns the compiled JSON node + the list of consumed contribution UUIDs
so the caller can mark them drained.

## 5. Correctness fixes

### Approval reject-reason mandatory

`POST /approvals/{opId}/reject` now requires a non-blank `reason`:
empty body / `""` / `"   "` all return `400 REJECTION_REASON_REQUIRED`.
UI disables the Reject button until a reason is typed. The queue
row-menu "Reject" item now navigates to the detail page where the
reason input is enforced.

### Referral accept no longer silently drops the payload

`POST /referral/inbox/{inboxId}/accept` previously marked an inbox
entry `ACCEPTED` even when `ReferralIngestService` wasn't present. Now:

- **503 `INGEST_UNAVAILABLE`** when the ingest bean isn't on this edge
- **502 `INGEST_FAILED`** when ingest throws
- **502 `INGEST_REJECTED`** when ingest returns `false` (inbox entry
  stays PENDING for retry)

The Referral inbox + detail UI surface the server message instead of
swallowing errors.

## 6. Admin UI

Designer surfaces the new workflow-level fields:

- **Requires approval** checkbox
- **Default assigned device** `<select>` populated from
  `/edge-api/v1/devices` (displayName + form-factor labels)
- **Program-stage section** added to the binding-kind options
- Step JSON hint documents the required `sectionKind` + `sectionRef`
  fields and lists all 7 valid values

Full form-based picker ships in 2.3.3; the JSON textarea is honest
scaffolding until then.

## 7. Verified live

```
Create workflow with requiresApproval + defaultDeviceId + 2 DATASET_SECTION steps
  → 200, id=3312dec8… requiresApproval=true steps=2 sectionKind=DATASET_SECTION ✓

Invalid section_kind for binding
  → 400 SECTION_KIND_INVALID
  "step 'wrong section' sectionKind=TEI_ATTRIBUTE_GROUP is not valid for a DATA_SET workflow" ✓

Reject with no body
  → 400 REJECTION_REASON_REQUIRED ✓
Reject with empty / whitespace reason
  → 400 ✓
Reject with valid reason on nonexistent op
  → 404 (correct — reached service) ✓

pageerrors: 0
```

## 8. Files changed

```
database/migrations/V045__workflow_breakable_sections.sql                  (new)
server/.../workflow/CaptureWorkflow.java                                    — + requiresApproval, defaultDeviceId; BindingKind + PROGRAM_STAGE_SECTION
server/.../workflow/CaptureWorkflowStep.java                                — + sectionKind, sectionRef; new SectionKind enum
server/.../workflow/CaptureWorkflowRepository.java                          — SELECT/INSERT + two new columns
server/.../workflow/CaptureWorkflowService.java                             — pass requiresApproval + defaultDeviceId through save()
server/.../workflow/CaptureWorkflowImportService.java                       — AD_HOC default when importing legacy canonicals
server/.../workflow/WorkflowCompiler.java                                   (new)
server/.../web/CaptureWorkflowController.java                               — WorkflowRequest + StepRequest + sectionKindCompatible validator
server/.../web/ApprovalController.java                                      — mandatory reject reason
server/.../web/ReferralInboxController.java                                 — 503/502 instead of silent no-op
server/src/test/java/.../workflow/*.java                                    — fixtures updated for new ctor args
admin-ui/src/api/edgeApi.ts                                                 — SectionKind type + new workflow + step fields
admin-ui/src/screens/EACoreScreens.tsx                                      — requires-approval checkbox + default-device select + section-kind JSON hint + PROGRAM_STAGE_SECTION option
admin-ui/src/screens/MoreScreens.tsx                                        — reject requires reason; row-menu Reject navigates to detail; referral errors surfaced
VERSION / server/pom.xml / admin-ui/package.json / sw.js                    — bumped to 2.3.0
```

## 9. Next in the Workflows march

- **2.3.1** — row-menu polish (Enable/Disable, Duplicate, Export JSON,
  View runs) + run drilldown page `/workflows/runs/:runId`
- **2.3.2** — designer validation (JSON parse pre-submit, step-ordinal
  checks, DAG acyclicity)
- **2.3.3** — form-based designer replacing raw JSON (section picker +
  device picker per step)

## Build + test

```
tsc -b && vite build                      ✓ 90 modules
./mvnw -q -DskipTests clean package       ✓ 2.3.0 JAR + V045 applied
E2E Playwright sweep                      ✓ workflow create, validation,
                                             reject-reason, inbox — 0 pageerrors
```
