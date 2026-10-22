# ADR-0024 — Workflow import/export + program-binding

- **Status:** Accepted (Phase 12 / der-1.3.0-alpha.3)
- **Related:** ADR-0018 (capture-workflow config), ADR-0022
  (device-owned steps), ADR-0023 (enforcement)
- **Roadmap:** Initiative 10 slice B — "event/tracker reconciler,
  workflow import/export"

## Context

Slice B so far has guarded only `/api/dataValueSets`. The capture
layer explicitly supports program + program-stage bindings in the
roadmap, but the schema CHECK and the service helpers were pinned to
`DATA_SET` while slice A shipped. Alpha.3 widens both sides and
simultaneously ships the import/export round-trip so a workflow can
move between DER installs (dev → pilot, pilot → prod).

## Decisions

### D-WIX-1 — Relax `bound_metadata_kind` CHECK to the full set

V019 drops the existing CHECK and recreates it with
`('DATA_SET','PROGRAM','PROGRAM_STAGE')`. No row backfill — existing
rows are all `DATA_SET`.

### D-WIX-2 — Service helpers for program + program-stage

`CaptureWorkflowService` adds `resolveForProgram(id)` and
`resolveForProgramStage(id)` that delegate to
`CaptureWorkflowRepository.findEnabledForBinding(kind, id)`.
Same semantics as `resolveForDataSet`.

### D-WIX-3 — Enforcement extends to `/api/events` and `/api/tracker/events`

`DeviceOwnerEnforcementInterceptor.shouldGuard()` is widened:

- `/api/dataValueSets` → sniff `dataSet`, lookup via DATA_SET.
- `/api/events` → sniff `program` (prefer) then `programStage`.
- `/api/tracker/events` → same as `/api/events`.
- `/api/tracker/enrollments` → sniff `program`.

The sniff order picks the most specific binding first (program-stage
over program). This is deterministic — a workflow bound to a program
stage shadows one bound to the parent program when both exist.

### D-WIX-4 — Canonical export shape

`GET /edge-api/v1/workflows/{id}/export` returns:

```json
{
  "schemaVersion": 1,
  "displayName": "Monthly ANC",
  "boundMetadataKind": "DATA_SET",
  "boundMetadataId": "ds-abc",
  "enabled": true,
  "steps": [
    {"ordinal": 0, "displayName": "ANC capture",
     "ownerRole": "OPERATOR", "ownerDeviceId": null,
     "stepKind": "CAPTURE",
     "fields": [{"fieldRef": "de-x.coc-y", "requirement": "REQUIRED"}]},
    …
  ],
  "dependencies": [
    {"fromOrdinal": 1, "toOrdinal": 0, "kind": "COMPLETES_BEFORE"}
  ]
}
```

Explicitly **stripped**: `workflowId`, step `stepId`, `createdAt`,
`updatedAt`, `createdBy`, `version`. Dependencies use step ordinals
rather than step UUIDs so the round-trip is install-independent.
`ownerDeviceId` is kept so same-install exports (e.g. seed-then-tweak
flows) round-trip losslessly.

### D-WIX-5 — Import endpoint accepts the canonical shape

`POST /edge-api/v1/workflows/import?dryRun=true|false` ingests the
canonical shape:

- `dryRun=true` validates the payload (schemaVersion, step ordinals
  non-negative + unique, dependency ordinals exist, no self-deps) and
  returns the computed shape + any warnings.
- `dryRun=false` creates a new workflow (new `workflowId`, new step
  ids, `version=1`, `createdBy = principal.userId`). The import
  **never upserts** — importing twice creates two workflows. Operators
  disable the old one explicitly.

### D-WIX-6 — Unknown `ownerDeviceId` is scrubbed, not rejected

If an imported step carries an `ownerDeviceId` that does not exist in
`edge_device` on this install, the import scrubs it to null and adds a
warning to the response. This keeps cross-install imports frictionless
while preserving same-install round-trip fidelity. Operators who
need the exact binding on the target install can enrol the matching
device first, then re-import.

### D-WIX-7 — ADMIN-only import, OPERATOR-or-higher export

Export is read-only — any-authenticated user can hit it. Import
creates workflow state and must be `hasRole("ADMIN")` like other
workflow mutations.

### D-WIX-8 — No bundled export (one workflow at a time)

Alpha.3 ships per-workflow export only. Bundled export (`GET
/workflows/export?ids=…`) + bundled import ship when workflow sets
become a concrete use case (post-slice-B).

## Non-goals

- Workflow set / bundle export.
- Programmatic device-id remap on import (operators enrol then
  re-import).
- Backwards-compat with `schemaVersion < 1` (there is none).
- Import conflict resolution against an existing workflow with the
  same `displayName` + `boundMetadataId` — the import always creates
  a new row; disabling the old one is operator work.
- Signed / notarised exports.

## Consequences

- The admin designer gets Export + Import buttons; the Import flow
  always runs a dryRun first and surfaces warnings before the
  confirm.
- `DeviceOwnerEnforcementInterceptor` now reads bodies on more paths
  so `OrgUnitBodyCachingFilter.shouldWrap()` is widened in lock-step.
- Workflows with the same `boundMetadataId` across different
  `boundMetadataKind` values coexist — program-stage bindings
  shadow their parent program binding in the enforcement sniff.
