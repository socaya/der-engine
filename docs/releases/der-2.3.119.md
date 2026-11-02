# der-2.3.119 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.118`

## Headline

**Three things user-flagged in one shot.** Data sub-nav shows a DER
glyph per tab; the queue-detail 404 is fixed (was a server SQL
grammar bug surfaced as "invalid credentials"); the queue filter
defaults to **Active** so synced rows don't clutter outstanding work,
with a one-click **Clean processed** button to purge the Sent
history.

## 1. R-AP/1 — Data sub-tab icons

Every Data group nav item now carries a `tabIcon`:

| Tab        | Icon        | Rationale                              |
|------------|-------------|----------------------------------------|
| Overview   | `overview`  | mini-grid dashboard glyph              |
| Aggregate  | `aggregate` | data-value / grid-of-cells             |
| Events     | `event`     | calendar tick (single event)           |
| Tracker    | `tei`       | person — tracker-entity metaphor       |
| Queue      | `data-queue`| outbound stack (unchanged)             |
| Drafts     | `edit`      | pencil — work-in-progress              |
| Referrals  | `referral`  | inbox-in                               |
| Referral history | `history` | clock dial                        |
| Maintenance| `cog`       | generic process / admin                |

`TabIconId` union extended with `aggregate | event | edit |
referral | cog` so each tab compiles against the shared type.

## 2. R-AP/2 — `/data/queue/:operationId` 404 fix

**Symptom**: `/admin/data/queue/<any-op-uuid>` always rendered
"Record not found · Error · invalid credentials".

**Root cause**: `OperationJournalRepository.findById()` SELECT was
missing the `workflow_run_id` column, but the shared
`rowMapper()` reads it via `rs.getObject("workflow_run_id",
UUID.class)`. Result:
`org.springframework.jdbc.BadSqlGrammarException` → Spring maps the
exception to 401 via a session-aware error handler → the admin UI's
generic 401 branch surfaces "invalid credentials". Confusing but
tractable: adding the missing column to the SELECT is the fix.

```java
"SELECT operation_id, entity_type, entity_ref, payload_json, state, "
      + "attempt_count, last_error, submitted_by, created_at, updated_at, "
      + "next_hop_org_unit_uid, workflow_run_id "   // ← was missing
      + "FROM der.operation_journal WHERE operation_id = ?"
```

Verified live: op `be92dc70-...` (part of pre-R-AL smoke data) now
loads with its full payload + workflow_run_id in one GET.

## 3. R-AP/3 — queue defaults to Active + Clean processed

User asked: *"MUST queues remain in the lists or once processed
successfully, it goes off (processed)"*. Answered via two UX
changes on `/data/queue`:

### Default filter → Active

Pre-2.3.119 the queue defaulted to `ALL`, so every row DER had
ever synced stayed visible — hundreds of green "Sent" rows mixed
with the five or six "Waiting / Rejected" rows that need triage.

Now the Status dropdown defaults to **Active (hide Sent)** — the
synthetic bucket meaning "every state except Sent". Operators see
only outstanding work on page load; switching to `Sent` or `All
statuses` surfaces history and audit respectively.

### Clean processed button

A new header-row button appears when `stateCounts.Sent > 0`:

```
Clean processed (12)   ← header action
```

Click → confirmation dialog (*"Delete 12 successfully-synced
record(s) from the local queue? …The data remains on Central
DHIS2 — this only clears the local sync-queue history. There is
no undo."*) → calls the existing `/admin/ops/journal/purge?
olderThanDays=0` endpoint and reloads the list.

Server-side `OperationsAdminController.purgeJournal` previously
clamped `days` at min 1; relaxed to min 0 so "purge all terminal
rows now" works. The existing retention cron (`days=90`
default) remains unchanged.

## 4. Live verification

```
GET /system/health                             → 200
POST /auth/sign-in                              → 200 (DER_SESSION cookie)
GET /journal/operations/be92dc70-...            → 200 ✓
  state=CENTRAL_REJECTED entityType=PROGRAM_STAGE_EVENT
  entityRef=MwW1PZFAQYh workflowRunId=31189dfc-...

tsc --noEmit                                    → clean
cross-module lint                               → clean
```

## 5. Files changed

```
server/.../workflows/aggregate/OperationJournalRepository.java
                                                — findById SELECT
                                                  + workflow_run_id
server/.../web/OperationsAdminController.java   — purgeJournal min=0

admin-ui/src/app/navigation.ts                  — tabIcon on every
                                                   Data nav item + 5
                                                   new TabIconId cases
admin-ui/src/api/edgeApi.ts                     — purgeTerminalJournalRows
admin-ui/src/screens/DataQueues.tsx             — default filter=ACTIVE
                                                   + Clean processed
                                                   button

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.119
```

## 6. Follow-ups

- Sent rows auto-hide client-side only; the DB keeps them for
  retention. Operators who use `Clean processed` get an immediate
  purge, so disk doesn't grow.
- Future UX: a sticky "last cleaned at <time>" chip in the queue
  header so operators know when the local history was last
  pruned. Defer until operators ask.
- Investigate the Spring error-mapper that turned a
  `BadSqlGrammarException` into HTTP 401 — surfacing it as 500
  with the message would have saved the ten-minute debugging
  session. Separate release.
