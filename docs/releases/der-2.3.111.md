# der-2.3.111 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.110`

## Headline

**All five DER-journaled data types are always visible.** The Data
overview grid and the Data Queue filter now use a canonical type
list rather than deriving it from observed journal rows — so a type
with zero rows still appears (as `0 · —`) instead of silently
disappearing.

## 1. R-AG — canonical journal entity-type list

**New export** in `screens/shared.tsx`:

```ts
export const JOURNAL_ENTITY_TYPES: ReadonlyArray<string> = [
  'AGGREGATE_DATA_VALUE',
  'EVENT',
  'TRACKED_ENTITY',
  'ENROLLMENT',
  'PROGRAM_STAGE_EVENT',
];
```

Mirrors `OperationJournalEntry.EntityType` server-side. One source
of truth for the client; server-origin extras merge in automatically
(forward-compat for a sixth journaled type).

### Data overview (`/data`)

**Before**: iterated `Object.entries(stats)` so a freshly-provisioned
edge with only aggregate data would show one row.

**After**: iterate `JOURNAL_ENTITY_TYPES` ∪ observed types. Zero
rows render as `0` captured / `—` pending so operators see the
complete catalogue of what DER tracks.

### Data queue filter (`/data/queue`)

**Before**: `types = Array.from(new Set(items.map(i => i.op.entityType)))`
— empty buckets disappeared from the dropdown.

**After**: `types = Array.from(new Set([
    ...JOURNAL_ENTITY_TYPES, ...observed]))`. Operators selecting
a type with zero current rows get a clear "no matching rows" state
instead of a missing filter option.

## 2. Not changed

- `AGGREGATE_DATA_VALUE`, `EVENT`, `TRACKED_ENTITY`, `ENROLLMENT`,
  `PROGRAM_STAGE_EVENT` are the complete set of entity types DER
  journals and pushes. Draft workflow entries, metadata-sync rows,
  and referral-inbox entries are stored in their own tables and
  surfaced on dedicated screens — not merged into the Data overview
  grid.
- The `entityTypeLabel()` + `entityTypeIcon()` helpers in
  `shared.tsx` continue to recognise 14 additional historical /
  alternate keys (`AGGREGATE`, `TEI`, `METADATA`, …); the canonical
  five are what we always render.

## 3. Files changed

```
admin-ui/src/screens/shared.tsx                 — + JOURNAL_ENTITY_TYPES
admin-ui/src/screens/DataManagement.tsx         — iterate canonical list
admin-ui/src/screens/DataQueues.tsx             — filter includes all 5

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.111
```

## 4. Live verification

```
GET /system/health                              → 200
tsc --noEmit                                     → clean
der-server-2.3.111.jar packaged + swapped       → OK
```

## 5. Follow-ups

- Pre-existing `ReferralInboxControllerTest#acceptMarksAccepted`
  cleanup — carried over from 2.3.110 notes.
- If a sixth journaled entity type lands server-side,
  `JOURNAL_ENTITY_TYPES` on the client must be updated (one spot
  in `shared.tsx`).
