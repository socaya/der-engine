# der-2.1.38 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.37`

## Headline

Sync history and queues become modern activity feeds instead of
Quartz-leaking tables. Each row leads with an icon chosen from the
payload type (📦 metadata, 🩺 data push, 📥 referrals, 📊 analytics,
etc.), a plain-English category + one-line "what was synced" sentence,
and a direction column with the arrow (`Central → DER`, `DER → Central`,
or `↔`) so operators can read sync direction at a glance.

Driven by the review note:

> "The sync history MUST show all the metadata and data synced, not the
> JOURNAL_WORKER_DRAIN etc, also show direction of synchronisation, and
> icons based on data synchronised, make it modern, also apply the same
> for queues etc."

## Changes

### `admin-ui/src/screens/mockups/shared.tsx`

- New `syncActivityShape(jobName, detail)` returns a `SyncActivityShape`
  `{ category, icon, direction, directionArrow, directionLabel, sentence }`
  for any job. Metadata/journal/referral/analytics/compat/backup/drift
  jobs each get a tailored icon, direction and sentence; unknown jobs
  fall back to a cog with `humaniseJob()` labelling.
- Direction model matches the architecture: metadata pull = `Central →
  DER`, data push = `DER → Central`, referral check = `Central → DER`,
  everything else (analytics, backups, drift) = `DER-local` with a `·`.
- New `queueEntityIcon(type)` / `queueEntityLabel(type)` share the same
  payload-type vocabulary with `QUEUE_ICON_BY_TYPE` covering aggregate,
  event, enrollment, TEI, metadata, program, data element, referral and
  org-unit shapes.

### `admin-ui/src/screens/mockups/SyncHistory.tsx`

- Table re-columned to `[icon] · What was synced · Direction · When ·
  Duration · Status`. The "What was synced" column shows the humanised
  category plus the one-line sentence (`"Nothing waiting to send —
  queue was empty."`, `"Pulled 1 243 metadata objects (4 new, 2 updated)."`
  and so on). Direction shows `Central → DER` / `DER → Central` with the
  arrow coloured in brand primary.
- Drawer header replaces the generic "Sync Details" title with the icon
  + category + sentence + direction block; the raw Quartz job name is
  still available further down as mono text so operators can grep logs.
- Dropped the hero header strip — the activity feed is self-explanatory
  and the hero was pure chrome.

### `admin-ui/src/screens/mockups/DataQueues.tsx`

- Same treatment: table re-columned to `[icon] · Data · Direction ·
  Queued · Status · Retry`. The outgoing/incoming segmented tabs are
  retitled to `Outgoing · DER → Central` / `Incoming · Central → DER`
  so direction is obvious before you even scan a row.
- Type filter shows humanised labels (`"Data value set"`,
  `"Tracked entity"`, …) instead of raw enum names.
- Drawer header mirrors the SyncHistory layout — icon + payload label +
  description + direction, then the detail list.
- Hero removed, matching the house style for the rest of the Sync hub.

## Live assertions (all green)

| Check                                               | Observed                                                                   |
|-----------------------------------------------------|----------------------------------------------------------------------------|
| `/sync/history` thead                               | `WHAT WAS SYNCED · DIRECTION · WHEN · DURATION · STATUS`                   |
| First sync row                                      | `🩺 Data push · Nothing waiting to send — queue was empty. · DER→Central`  |
| No `JOURNAL_WORKER_DRAIN` leaking into main table   | pass                                                                       |
| `/sync/queues` thead                                | `DATA · DIRECTION · QUEUED · STATUS · RETRY`                               |
| Outgoing tab label                                  | `Outgoing · DER → Central · N`                                             |
| Incoming tab label                                  | `Incoming · Central → DER · N`                                             |
| Hero removed from both screens                      | pass                                                                       |

Verification harness: `admin-ui/verify-sync-feed.cjs` against the
running local DER + DHIS2 2.44-SNAPSHOT.
