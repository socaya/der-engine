# der-2.3.109 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.108`

## Headline

**Approvals can now be inspected before approval.** The approval
detail page gains a labelled "**Data › View <record> ↗**" affordance
routing per entity type into the matching Data screen. Operators no
longer approve blind. Referral drill queued separately (needs
server-side ingest-run exposure).

## 1. R-AD — ApprovalDetail "View record" drill

**Context**

`MockupApprovalDetail` (`/approvals/:operationId`) rendered the
pending record as plain text (`Event · abc123`) with no way to open
the record itself. Operators had to context-switch via the sidebar
+ paste the entityRef into a Data screen to see what they were
approving.

**Fix**

A labelled Link in the SyncStatusBar actions row, next to Approve +
Reject:

```
Data › View event ↗               (for EVENT)
Data › View tracked entity ↗      (for TRACKED_ENTITY)
Data › View enrolment ↗           (for ENROLLMENT) — → /data/queue/{opId}
Data › View stage event ↗         (for PROGRAM_STAGE_EVENT) — → /data/queue/{opId}
Data › View data value ↗          (for AGGREGATE_DATA_VALUE) — → /data/queue/{opId}
Data › View operation ↗           (fallback) — → /data/queue/{opId}
```

Routing rule:

- `EVENT` → `/data/events/{eventId}` (dedicated detail page exists)
- `TRACKED_ENTITY` → `/data/tracker/tei/{teiUid}` (dedicated page)
- All other kinds → `/data/queue/{operationId}` (the operation
  detail page shows the payload + journal history)

Aggregate deliberately uses the queue route rather than
`/data/aggregate/{valueId}` because the approval `entityRef` is the
DHIS2 compound key (`dataElement|orgUnit|period|coc|aoc`), not the
local value UUID that the detail route expects.

**Rule compliance**

- Labelled with the target module name (`Data ›`) and a trailing
  `↗` glyph.
- `title="Open the <kind> in the Data module"` for keyboard +
  screen-reader users.
- `data-test="approval-view-record"` for E2E.

## 2. Referral drill — queued for R-AE

`MockupReferralDetail` has the same isolation gap but the fix is
not clean client-side:

- `referral_inbox` table carries `source_ref` (where the record came
  from on Central) but **not** the `workflow_run_id` that the
  ingest produces.
- `ReferralIngestService` creates the system workflow run but the
  run id isn't threaded back onto the referral row.

**R-AE plan** (deferred):

1. Migration `V081__referral_ingest_run_link.sql`: add
   `ingest_run_id UUID REFERENCES capture_workflow_run(run_id)`
   column.
2. `ReferralIngestService.acceptSingle()` sets it after
   `ensureReferralIngestRun`.
3. `ReferralInboxRepository` + `ReferralInboxEntry` + the row DTO
   expose it.
4. `MockupReferralDetail` renders "Workflows › View ingest run ↗"
   when present — operators drill into the workflow run to see the
   produced operation(s).

Not shipped here to keep R-AD scope tight.

## 3. Live verification

```
GET /system/health                                 → 200
tsc --noEmit                                        → clean
admin-ui bundle                                     → 2.3.109
der-server-2.3.109.jar packaged + swapped          → OK
```

## 4. Files changed

```
admin-ui/src/screens/MoreScreens.tsx                — ApprovalDetail
                                                      "View record ↗"

VERSION / server/pom.xml / admin-ui/package.json / sw.js  → 2.3.109
```

## 5. Follow-ups

- **R-AE** — Referral ingest-run link (migration + service + DTO +
  UI).
- **R-AF** — Server-side lint attribute `data-cross-module` on
  every `<Link>` crossing a module boundary, enforced in a Vitest
  rule. Picked up from R-AC soft follow-up.
- Review for any **other** isolation gaps where a detail screen
  references an entity it can't drill into — SyncHistory operation
  detail, DriftInspector resource detail, etc.
