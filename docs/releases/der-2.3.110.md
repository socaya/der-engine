# der-2.3.110 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.109`

## Headline

**Two UX closers.** ReferralDetail now drills into the workflow run
that ingested it (R-AE). WorkflowPicker in every Data filter row is
type-ahead searchable (R-AF).

## 1. R-AE — ReferralDetail ingest-run drill

**Migration V081**

```
ALTER TABLE referral_inbox
    ADD COLUMN IF NOT EXISTS ingest_run_id UUID
        REFERENCES capture_workflow_run(run_id)
        ON DELETE SET NULL;
```

Nullable because historical ACCEPTED rows pre-date the column.

**Server**

- `ReferralInboxEntry` record gains `ingestRunId`.
- `ReferralInboxRepository.setIngestRunId(inboxId, runId)` — writes
  the run id after a successful ingest. State-guarded (`WHERE
  ingest_run_id IS NULL`) so re-accept is idempotent.
- `ReferralIngestService` injects the repo and calls
  `setIngestRunId()` after both aggregate and event ingest paths.
- `ReferralInboxController.toJson()` surfaces `ingestRunId`.

**Client**

- `ReferralInboxRow` TypeScript interface grows the optional field.
- `MockupReferralDetail` SyncStatusBar now renders a labelled drill
  when `status === 'ACCEPTED' && ingestRunId`:
  ```
  Workflows › View ingest run ↗
  ```
  Omitted for PENDING / DISMISSED and for pre-V081 historical rows.

## 2. R-AF — Searchable WorkflowPicker

Previously the `WorkflowPicker` was a plain `<select>` with up to 50
options and no filter. On deployments with lots of workflows the
dropdown was unmanageable.

Rewritten to mirror `MetadataPicker`:

- Type-ahead `<input>` with a floating result dropdown.
- Lazy-load the catalogue on first focus; cached for the session.
- Matches against `displayName`, `workflowId`,
  `boundMetadataKind`, and `boundMetadataId`.
- "Any workflow" row at the top of the dropdown clears the filter.
- Shows the `boundMetadataKind · boundMetadataId` as muted sub-label
  per row so operators pick the right one when names collide.
- `disabled` chip rendered inline when the workflow is disabled.
- Props unchanged (same `value / onChange / boundKind / placeholder
  / dataTest`) — all three Data screens get the UX upgrade without
  code changes.

## 3. Pre-existing test note

`ReferralInboxControllerTest#acceptMarksAccepted` was already failing
on `main` before R-AE (assertion mismatch after the V045 "ingest
mandatory" change). Confirmed via `git stash` + rerun on the parent
commit (`5d92b39`). Not a regression from this release. Logged for
cleanup — out of scope here.

## 4. Live verification

```
GET /system/health                             → 200
Flyway: applied V081 cleanly                   → OK
tsc --noEmit                                    → clean
admin-ui bundle                                 → 2.3.110
```

Server-side regression suite (89 tests across our known-good
targets):

```
cd server && ./mvnw test \
       -Dtest='ReferralIngestServiceTest,
               ReferralInboxRepositoryTest,
               DhisPeriodCodesTest,
               ReferralPayloadEncoderTest,
               TrackerServiceTest,
               JournalPublisherTest,
               CaptureWorkflowControllerTest'       ✓ 89/89
```

## 5. Files changed

```
database/migrations/V081__referral_ingest_run_link.sql
                                                   — NEW

server/.../workflows/referral/ReferralInboxEntry.java
                                                   — + ingestRunId
server/.../workflows/referral/ReferralInboxRepository.java
                                                   — setIngestRunId()
                                                   + mapper update
server/.../workflows/referral/ReferralInboxScanner.java
                                                   — 10-arg ctor
server/.../workflows/referral/ReferralIngestService.java
                                                   — inject + call
                                                   setIngestRunId()
server/.../web/ReferralInboxController.java        — toJson() surfaces
                                                   ingestRunId

server/.../test/.../ReferralIngestServiceTest.java — 10-arg ctor
                                                   + inbox mock
server/.../test/.../ReferralInboxRepositoryTest.java — 10-arg ctor
server/.../test/.../ReferralInboxControllerTest.java — 10-arg ctor

admin-ui/src/api/edgeApi.ts                        — ReferralInboxRow.
                                                   ingestRunId?
admin-ui/src/screens/MoreScreens.tsx               — ReferralDetail
                                                   "Workflows › View
                                                   ingest run ↗"
admin-ui/src/components/WorkflowPicker.tsx         — type-ahead rewrite

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.110
```

## 6. Follow-ups queued

- **Data overview / queue data-type filter** — user flag:
  the Data overview page shows only the five
  `operation_journal.entity_type` kinds (AGGREGATE_DATA_VALUE,
  EVENT, TRACKED_ENTITY, ENROLLMENT, PROGRAM_STAGE_EVENT) and the
  queue data-type filter should enumerate everything DER tracks.
  Audit + fix queued as R-AG.
- Pre-existing `acceptMarksAccepted` test cleanup.
