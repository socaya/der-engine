# der-2.1.41 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.40`

## Headline

Modernise the right-pane drawer across `/sync/history` and
`/sync/queues` so operators can see the **actual synchronised JSON
payload** — not just a run summary. Fold in Sync overview feedback
too: remove the redundant "Sync sub-modules" tile grid, fix the
"Last sync / Last duration" stat strip that was permanently stuck on
`—`, and rebuild the "Journal by data type" table on top of a real
backlog breakdown endpoint.

## Changes

### Server — payload exposure

- `JournalWorker.drainBatch` tallies the UUID of every operation it
  picks up, and `JournalWorker.DrainOutcome` now carries that list in a
  new `operationIds` field. The legacy 6-arg constructor is preserved
  for existing tests.
- `JournalDrainJob` emits `operationIds` in the Quartz run detail JSON
  alongside the existing `picked / accepted / rejected / byType` keys.
- `OperationJournalRepository.findById` SQL re-included the
  `next_hop_org_unit_uid` column (it was missing from the SELECT list
  which caused the row mapper to blow up with a `BadSqlGrammarException`
  the first time anything called `findById` through the REST surface).
- New `GET /edge-api/v1/journal/operations/{operationId}` returns the
  full `OperationJournalEntry` including the `payload_json` body.
- New `GET /edge-api/v1/journal/stats/by-type` returns a stable map of
  every known entity type (AGGREGATE_DATA_VALUE, EVENT,
  PROGRAM_STAGE_EVENT, TRACKED_ENTITY, ENROLLMENT) → counts in each
  state. Zero rows are always included so the UI table has a stable set
  of rows regardless of what has actually been captured.

### Admin UI — tabbed drawer + JSON viewer

- `shared.tsx`
  - New `DrawerTabs` primitive — compact underline tabs with optional
    numeric badges per tab.
  - New `JsonViewer` component — collapsible JSON tree, syntax-coloured
    (string / number / boolean / null / key), with a Copy-to-clipboard
    header. Nodes >= `maxDepth` auto-collapse so the drawer doesn't
    explode for nested payloads.
  - New `parseOperationIds(detail)` helper mirrors `parseByType`.
- `SyncHistory.tsx` drawer re-shaped into three tabs:
  - **Overview** — run metadata (ID, job, status, started/finished,
    duration, triggered by).
  - **Payload** — per-type breakdown tiles (icon + label + count) on
    top, then up to five of the actual records fetched from the new
    `/edge-api/v1/journal/operations/{id}` endpoint, each rendered with
    its own `JsonViewer`. Below the records: the remaining run detail
    fields (picked / accepted / rejected / retryable / conflicts) as a
    labelled list.
  - **Related** — the existing explore-payload tiles.
- `DataQueues.tsx` drawer re-shaped into two tabs:
  - **Overview** — code, status, created / age, retry count, operation
    ID.
  - **Payload** — the full `payload_json` for the selected operation,
    fetched lazily on first open and rendered through `JsonViewer`.
    When the operation has a `last_error` the drawer surfaces it as a
    red strip under the payload.

### Admin UI — SyncOverview feedback

- Dropped the "Sync sub-modules" tile grid. Those destinations already
  live in the sidebar / section tabs — the extra 8-tile grid was pure
  chrome.
- Stat strip no longer renders `—` for the `Last sync` / `Last duration`
  slots when the most recent run was `FAILED`: the fallback now walks
  the full job list and picks the newest *any-outcome* run. "Reliability
  (24h)" shows `No data` when there's nothing in the 24h window instead
  of defaulting to a misleading `100%`. `SUCCESS` is now treated the
  same as `SUCCEEDED` throughout (the server uses `SUCCESS`).
- 24h activity chart bins into 12 two-hour slots instead of 24
  one-hour slots. Labels use locale time (`HH:MM`) rather than the
  previous `${hour}h` which read as a duration.
- The "Journal by data type" panel is renamed **Outbound queue · by
  data type** and rebuilt on the new `/journal/stats/by-type` endpoint.
  Columns: `[icon] · Data type · Pending · In flight · Accepted · Needs
  review · Status`. Every row shows a humanised label (`Aggregate data`,
  `Single event`, `Tracker event`, …) plus the raw enum below it in
  mono, and clicking a row navigates to `/sync/queues` so the operator
  can inspect records.

## Live assertions (all green)

Seeded three test operations (one aggregate, one single event, one
tracked entity) + one conflict row, triggered the drain, then swept the
screens with Playwright:

| Check                                                    | Result |
|----------------------------------------------------------|--------|
| `/sync/history` drawer has Overview / Payload / Related tabs | ✓ |
| Payload tab renders the "Records" header                  | ✓ |
| Payload tab shows record field names (dataElement, period, value) | ✓ |
| Payload tab has a Copy button                             | ✓ |
| `/sync/queues` drawer has Payload tab + Copy button       | ✓ |
| Queue drawer renders full payload JSON for selected row    | ✓ |
| `/sync` overview has no Sync sub-modules section          | ✓ |
| Overview has "Outbound queue · by data type" table        | ✓ |
| Table shows Aggregate data / Single event / Tracked entity rows | ✓ |
| Overview stat strip no longer renders `Last sync —`       | ✓ |

Verification harness: `admin-ui/verify-drawer.cjs` against the running
local DER + DHIS2 2.44-SNAPSHOT.
