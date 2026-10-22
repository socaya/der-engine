# DER 1.3.0-alpha.3 — Initiative 10 slice B: program-binding + import/export

> **Scope:** Bundles two slice B items. Capture workflows can now bind
> to `PROGRAM` / `PROGRAM_STAGE` metadata (not just `DATA_SET`), and
> device-owner enforcement extends to `/api/events` and
> `/api/tracker/**`. Workflows round-trip as canonical JSON via a new
> export + import pair.

**Release label:** `der-1.3.0-alpha.3`
**Git tag:** `der-1.3.0-alpha.3`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

### Program-binding

- Database migration **V019** — relax
  `capture_workflow.bound_metadata_kind` CHECK to allow
  `PROGRAM` + `PROGRAM_STAGE` alongside `DATA_SET`. No row backfill.
- `CaptureWorkflow.BindingKind` enum widened.
- `CaptureWorkflowService.resolveForProgram(id)` and
  `resolveForProgramStage(id)` service helpers.
- `DeviceOwnerEnforcementInterceptor` now guards `/api/events`,
  `/api/tracker/events`, `/api/tracker/enrollments` in addition to
  `/api/dataValueSets`. Sniff order picks program-stage before
  program before dataSet (ADR-0024 D-WIX-3) so a stage binding
  shadows its parent-program binding.
- Admin UI designer gets a binding-kind `<select>` (DATA_SET /
  PROGRAM / PROGRAM_STAGE); existing workflows round-trip their kind.

### Import / export

- `GET /edge-api/v1/workflows/{id}/export` → canonical JSON
  (`schemaVersion: 1`, no server-generated ids / timestamps,
  dependencies use step ordinals so the shape is install-independent).
- `POST /edge-api/v1/workflows/import?dryRun=true|false` — ADMIN only.
  Validates schemaVersion + ordinals + non-empty steps; scrubs
  unknown `ownerDeviceId`s with a warning (D-WIX-6) rather than
  rejecting.
- `edgeApi.exportWorkflow` + `edgeApi.importWorkflow` helpers.
- Admin UI designer gains Export / Import sections — Export dumps
  the canonical JSON into a readonly textarea; Import accepts a
  pasted blob and offers Validate (dry-run) + Apply buttons; warnings
  from the server render in a list.
- ADR-0024 locks in: single-workflow export, canonical shape,
  schemaVersion 1, unknown-device scrub, no bundled import, no
  conflict-resolve-against-existing (operators disable+re-import).

## Behaviour

```
GET /edge-api/v1/workflows/{id}/export
    → { "schemaVersion": 1, "displayName": "...",
        "boundMetadataKind": "PROGRAM_STAGE", "boundMetadataId": "ps-x",
        "enabled": true,
        "steps": [{"ordinal": 0, "displayName": "...", ...}],
        "dependencies": [{"fromOrdinal": 1, "toOrdinal": 0,
                          "kind": "COMPLETES_BEFORE"}] }

POST /api/events  { "program": "p1", … }
    ↳ DeviceOwnerEnforcementInterceptor
         sniffs programStage → program → dataSet (in order)
         resolveForProgram("p1") → applicable workflow
         if any step owns a device, require matching X-DER-Device-Id
```

| Payload field | Guarded path | Lookup |
|---|---|---|
| `dataSet` | `/api/dataValueSets` | DATA_SET |
| `programStage` | `/api/events`, `/api/tracker/events`, `/api/tracker/enrollments` | PROGRAM_STAGE first |
| `program` | same | PROGRAM fallback |

## Test state

- **1143 server tests** pass (was 1127 + 13 import service + 3
  controller + 3 interceptor path-coverage). `mvn verify` green.
- **222 admin-ui tests** pass (was 212 + 10 import/export + 1
  binding-kind). Vitest at **100 / 90.66 / 97.81 / 100** — thresholds
  unchanged.
- Client: unchanged (153 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred)

- Bundled workflow export (`?ids=…`) — slice B explicitly ships
  per-workflow only.
- Programmatic device-id remap on import — operators enrol then
  re-import.
- Conflict resolution against an existing workflow with the same
  `displayName` + `boundMetadataId` — the import always creates a
  new row.
- Reconciler scaffolding (contribution tracking, drain-time
  recomposition) — needs its own alpha with run-state design.
- MFA (Initiative 8 part 3), chain-via-hub referral (Initiative 3),
  DHIS2 Edge Agent server plugin (Initiative 2 part 1).

## Promotion path

`der-1.3.0-alpha.3` → alpha.4 (reconciler scaffolding) → alpha.5+
(MFA / Initiative 2 / Initiative 3) → stable `der-1.3.0`.
