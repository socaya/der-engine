# der-2.1.39 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.38`

## Headline

Review feedback on 2.1.38's activity feed:

> "Why do I see some `Central ← DER` yet we have most as `DER → Central`?
> Also, I still don't see whether it was Metadata of a specific metadata
> type of data of either Aggregate, Tracker or Single Events Programs
> were synchronized. What we have is still quite vague. Fix please. Also
> can we have on the right pane the synchronised Payload regardless of
> the direction."

Three fixes:

1. **Direction arrow consistency.** The direction column now always
   renders a `source → target` sentence with a single arrow glyph.
   Pulls read `Central → DER`, pushes read `DER → Central`, local
   housekeeping jobs read `DER-local` with no arrow. The old
   `Central ← DER` rendering (arrow pointing one way, label the other)
   is gone.
2. **Entity-type breakdown in every drain run.** The server now tallies
   outgoing operations by `entityType` inside `JournalWorker.drainBatch`
   and emits a `byType` map in the Quartz run detail:

   ```
   {"picked":5,"accepted":3,"rejected":2,"conflicts":0,"retryable":0,
    "byType":{"AGGREGATE_DATA_VALUE":2,"EVENT":1,"PROGRAM_STAGE_EVENT":1,
              "TRACKED_ENTITY":1}}
   ```

   The admin UI turns `byType` into both the row category / icon
   (single-type → `Aggregate data push`, mixed → `Mixed data push`) and
   the row sentence (`Pushed 2 aggregate data · 1 single event · 1
   tracker event · 1 tracked entity · 3 accepted · 2 rejected.`).
3. **Payload section on the drawer, always.** Below the run metadata,
   `/sync/history` now renders a dedicated **Payload** block showing
   each entity-type with its icon, humanised label and count. When a run
   didn't move any records it says so explicitly instead of leaving the
   pane empty. All remaining detail fields (`picked`, `accepted`, …) are
   rendered underneath as a labelled list rather than the previous raw
   JSON blob.

## Changes

### Server

- `server/.../workflows/journal/JournalWorker.java`
  - `drainBatch()` tallies pending entries by `entityType.name()` into
    a `LinkedHashMap<String, Integer>`.
  - `DrainOutcome` grew a `Map<String, Integer> byType` field; a legacy
    6-arg constructor preserves source-compat for existing callers.
- `server/.../scheduler/JournalDrainJob.java`
  - Builds the detail JSON through a `LinkedHashMap` so `byType` is
    emitted only when the batch picked up anything, keeping the detail
    stream tidy for empty idle runs.

### Admin UI

- `admin-ui/.../screens/mockups/shared.tsx`
  - All sync activity shapes now use `→` for the arrow glyph; direction
    is conveyed by swapping the source/target labels, not by flipping
    the arrow.
  - `ENTITY_TYPE_LABEL` / `ENTITY_TYPE_ICON` maps provide operator-
    facing names: `AGGREGATE_DATA_VALUE → "Aggregate data"`,
    `EVENT → "Single event"`, `PROGRAM_STAGE_EVENT → "Tracker event"`,
    `TRACKED_ENTITY → "Tracked entity"`, `ENROLLMENT → "Enrollment"`.
  - New helpers: `entityTypeLabel`, `entityTypeIcon`, `parseByType`,
    `detailEntries`, `dataPushCategory`, `dataPushIcon`. `syncActivityShape`
    now derives category + icon from `byType` when present.
  - `dataPushSentence` prefixes the per-type counts (`"Pushed 2
    aggregate data · 1 single event · 1 tracker event"`) when `byType`
    is set, falling back to the generic sentence when it isn't.
- `admin-ui/.../screens/mockups/SyncHistory.tsx`
  - Direction cell renders `source → target` with the `local` branch
    showing a quiet `DER-local` label instead of splitting the string
    and double-rendering `DER-local`.
  - Drawer gained a **Payload** header with the entity-type tiles, plus
    a fallback copy for empty runs.
  - Removed the dead `summariseDetail` helper.
- `admin-ui/.../screens/mockups/DataQueues.tsx`
  - Incoming tab's row direction fixed — was rendering
    `Central ← DER` (left-pointing arrow with mismatched operands),
    now reads `Central → DER` consistently with the tab title.

## Live assertions (all green)

| Check                                             | Observed                                                                                                                              |
|---------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| Seeded drain detail                                | `{"byType":{"AGGREGATE_DATA_VALUE":2,"EVENT":1,"PROGRAM_STAGE_EVENT":1,"TRACKED_ENTITY":1},"picked":5,"accepted":3,"rejected":2,…}`    |
| `/sync/history` row for that run                   | `🩺 Mixed data push · Pushed 1 single event · 1 tracked entity · 1 tracker event · 2 aggregate data · 3 accepted · 2 rejected · DER→Central` |
| No `Central ← DER` string anywhere                 | pass                                                                                                                                  |
| `/sync/history` drawer **Payload** panel          | lists entity-type tiles with icon + humanised label + count                                                                           |
| `/sync/queues` Incoming tab                        | `Incoming · Central → DER`, row direction `Central → DER`                                                                             |

Verification harness: `admin-ui/verify-payload.cjs` against the running
local DER + DHIS2 2.44-SNAPSHOT.
