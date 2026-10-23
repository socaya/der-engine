# der-2.0.3-alpha.2 — metadata drift surface evidence

**Captured:** 2026-10-23

## Surface

- `MetadataDriftDetector` service: given an `OperationJournalEntry`,
  inspects the payload for references to metadata UIDs that no longer
  resolve in the local mirror. Returns a `DriftReport(operationId,
  missing[])` with per-ref `{kind, field, uid}`.
- `GET /edge-api/v1/metadata/drift/pending` — scans the pending
  journal (configurable limit), returns the drift-affected entries.
- `GET /edge-api/v1/metadata/diagnostics` — effective-config snapshot
  (per-kind mirror row counts) + drift summary (pending scanned,
  entries with drift, missing-by-kind).
- `POST /edge-api/v1/admin/ops/journal/{opId}/quarantine` — moves a
  drift-affected entry to `CONFLICT_REVIEW` with a reason string
  persisted on `last_error`. Audit event `JOURNAL_QUARANTINE`.

## Checked references per entity type

| Entity type | Fields checked |
|---|---|
| `AGGREGATE_DATA_VALUE` | dataSet, orgUnit, dataElement (envelope + each dataValues[]), categoryOptionCombo |
| `EVENT`, `PROGRAM_STAGE_EVENT` | program, programStage, orgUnit |
| `ENROLLMENT` | program, orgUnit |
| `TRACKED_ENTITY` | trackedEntityType, orgUnit; nested enrollments[].program |

## Live diagnostics

See `diagnostics.json` captured against local DHIS2 2.44-SNAPSHOT
with Sierra Leone demo metadata:

```
mirrorCounts: {
  organisationUnits: 484,
  dataElements: 358,
  dataSets: 0,
  programs: 31,
  trackedEntityTypes: 1
}
```

The empty `drift` section reflects no pending journal entries at
probe time.

## Behavioural model

- **FR-05-10 Identify pending operations made against changed or
  incompatible definitions.** `MetadataDriftDetector.evaluate()` is
  the identifier. Operators invoke it ad-hoc via `/drift/pending`
  or periodically via a Quartz task (alpha.3 hook).
- **FR-05-11 Prevent silent reinterpretation of affected pending
  changes.** The quarantine endpoint moves drifted entries to
  `CONFLICT_REVIEW` with reason persisted. The drain worker already
  skips `CONFLICT_REVIEW` state so there is no silent retry.
- **FR-05-12 Present missing dependencies, mismatches and effective
  local configuration.** `/diagnostics` is the single-call summary.

## Unit test coverage

Suite: `MetadataDriftDetectorTest` (7 cases) covers:
- Clean path: all refs resolve → no drift.
- Missing dataElement in a dataValues array → DATA_ELEMENT flagged.
- Missing program on an event → PROGRAM flagged.
- Missing program on an enrollment.
- Missing trackedEntityType on a TEI.
- Null-ish payload → no drift (defensive).
- Summary rendering when no drift present.
