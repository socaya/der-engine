# der-2.1.1 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.1.0`

## Headline

Make the two Sync directions explicit on the hub, and make
every job-run payload-explorable from the Jobs drawer.

## Sync is two directions, not one

Per the project model:

- **Metadata**: `Central → DER` — one-way. DHIS2 is the source
  of truth; DER mirrors it locally so capture surfaces keep
  running when the WAN drops.
- **Data**: `Central ↔ DER` — two-way. Local captures journal
  up to central, and central-held OU data syncs down so
  distributed workflows share the same record.

Previously the hub showed a single `DER → DHIS2` arrow which
undersold the metadata-pull direction and hid the Data
bidirectionality completely.

### `admin-ui/src/screens/mockups/SyncOverview.tsx`

Replaced the single sync-flow diagram with a two-lane
"Synchronisation directions" panel. Each lane renders:

- A compact `Central <arrow> DER` row with the correct arrow
  (`→` for Metadata, `↔` for Data).
- A one-line label `<Kind> · Central <arrow> DER (<direction>)`.
- A short rationale paragraph.
- A tone-coded badge chip (`one-way` info, `two-way` success).

The old `.ea-sync-progress-row` block (Last batch · Last tick ·
Backlog) is kept beneath, so operational numbers stay in sight.
Side-by-side with the "24h activity" chart as before.

## Payload exploration from a Job run

### `admin-ui/src/screens/mockups/MoreScreens.tsx` — `MockupJobsList`

The right-drawer that already showed run metadata now carries
an **Explore payload** section with contextual links. Mapping
is driven by job name:

| Job name contains | Related links                                   |
|-------------------|-------------------------------------------------|
| `METADATA`        | Metadata browser · Metadata drift              |
| `JOURNAL`, `DRAIN`, `PUSH` | Queues · Conflicts                      |
| `REFERRAL`        | Referral inbox                                  |
| (anything else)   | Sync history                                    |

Each link renders as an `ea-link-tile` so operators get a
single click from "that run" to "the actual data it processed".

## Live verification

### Directions panel

| Check                              | Observed                                                 |
|------------------------------------|----------------------------------------------------------|
| Panel `data-test`                  | present                                                  |
| Metadata lane                      | `Central → DER (pull only)` + `one-way` chip             |
| Data lane                          | `Central ↔ DER (push + pull)` + `two-way` chip           |

### Jobs drawer

Clicked the latest `JOURNAL_WORKER_DRAIN` run:

- Run metadata rendered (ID `2569`, outcome `SUCCESS`, detail
  JSON `{"picked":0,"accepted":0,...}`).
- `EXPLORE PAYLOAD` tiles rendered as expected:
  **Queues** → "Journal items pushed up to DHIS2 central"
  **Conflicts** → "Operations that failed to drain"

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.1/V211F-sync-hub.png`
+ `V211F-jobs-drawer.png` (+ `V211-sync-directions.png` from
the initial build check).
