# der-2.1.32 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.31`

## Headline

Make the four remaining `/sync/*` screens read like something an
operator can actually use, not something only a Quartz /
journal engineer can decode. Raw internal identifiers are now
humanised across Jobs, Sync history, Journal worker and the
Sync schedule editor, with the original constant kept nearby
only as a small muted tooltip for operators who still want it.

## Why

Audit of the Sync module revealed:

- `/sync/jobs` showed job names as uppercase Quartz constants:
  `METADATA_SYNC_FULL`, `JOURNAL_WORKER_DRAIN`, `ANALYTICS_REFRESH`.
- `/sync/history` showed the same constants plus a `MESSAGE`
  column rendered as raw JSON (`{"picked":0,"accepted":0,...}`).
- `/journal/worker` showed backlog states as `PENDING`,
  `IN_FLIGHT`, `CENTRAL_ACCEPTED`, `CENTRAL_REJECTED`,
  `RETRYABLE`, `UNKNOWN_OUTCOME`, `CONFLICT_REVIEW`.
- `/sync/schedule` showed a lone cron expression `0 */5 * * * ?`
  keyed as `sync.metadata` with no plain-English context.

## Changes

### New shared helpers in `admin-ui/src/screens/mockups/shared.tsx`

- `humaniseJob(name)` — maps 12 known Quartz job constants to
  user-facing labels (e.g. `METADATA_SYNC_FULL` → "Pull latest
  metadata", `JOURNAL_WORKER_DRAIN` → "Push outgoing data",
  `ANALYTICS_REFRESH` → "Rebuild analytics tables",
  `REFERRAL_INBOX_POLL` → "Check incoming referrals"). Unknown
  constants fall back to Title-Case of the raw name.
- `humaniseState(state)` — maps 14 known journal / worker /
  trigger-outcome states (e.g. `IN_FLIGHT` → "In transit",
  `CENTRAL_ACCEPTED` → "Accepted by DHIS2", `RETRYABLE` →
  "Will retry", `SCHEDULED` → "Scheduled", `SUCCEEDED` →
  "Succeeded"). Unknown states fall back to Title-Case.
- `describeCron(expr)` — turns Quartz cron into plain English
  for the three common patterns we ship: "Every N minutes",
  "Every N hours", "Daily at HH:MM". Anything else → "Custom
  schedule". Keeps the exact expression one hover away.

### `admin-ui/src/screens/mockups/MoreScreens.tsx`

- Jobs table: job name cell now shows `humaniseJob(jobName)`
  on top of the raw constant in a muted 10 px mono line, kept
  as a hover `title`. Outcome chip uses `humaniseState`.
- Jobs drawer: Job / Outcome / Triggered-by rows humanised;
  raw constant line kept below Job for ops.
- Journal worker backlog table: state cell shows the humanised
  label as the chip, the raw constant appears next to it as a
  10 px muted mono tail. Chip tone widened to pick danger for
  `FAILED` + `CENTRAL_REJECTED`, warning for `PENDING` +
  `RETRYABLE` + `CONFLICT_REVIEW`, success for
  `CENTRAL_ACCEPTED`.

### `admin-ui/src/screens/mockups/SyncHistory.tsx`

- Row columns: Device/User, Resource, Operation, Status all
  humanised. The old raw-JSON `MESSAGE` column is replaced
  with a one-line sentence (`0 accepted · 0 rejected · 0 to
  retry`) produced by a new local `summariseDetail` helper that
  reads the structured fields jobs attach.
- Drawer: same humanisation. "Outcome summary" now sits above
  the raw detail JSON, which still appears below for anyone
  debugging.

### `admin-ui/src/screens/CapabilityScreens.tsx` — `CapSyncSchedule`

- Rewrote the sync-schedule editor:
  - Each configured cron key renders as a two-column card: a
    human title + description + plain-English cron summary chip
    on the left; the editable cron input + Quartz syntax hint
    on the right. Marked each row with `data-test="cron-row-*"`
    and the input with `data-test="cron-input-*"`.
  - New local `scheduleKeyInfo(key)` maps the shipped keys
    (`sync.metadata`, `sync.data`, `analytics.refresh`,
    `referral.inbox`, `backup.rotate`, `compat.refresh`) to
    a plain title + one-sentence description.
  - Imported `describeCron` from `./mockups/shared` so each
    row shows "Every 5 minutes" / "Daily at 02:30" / etc.

## Live assertions (all green)

| Check                                                  | Observed                                                                            |
|--------------------------------------------------------|-------------------------------------------------------------------------------------|
| `/sync/jobs` row body contains                         | `Push outgoing data` (humanised JOURNAL_WORKER_DRAIN)                               |
| `/sync/history` detail cell contains                   | `0 accepted` (summariseDetail output replacing raw JSON)                           |
| `/journal/worker` state cell contains                  | `Accepted by DHIS2` (humanised CENTRAL_ACCEPTED)                                   |
| `/sync/schedule` first-row card contains               | `Pull latest metadata` + description + `Every 5 minutes` chip                       |

Evidence:
- `docs/evaluation/evidence/alpha.35-der-2.1.32/VF-jobs.png`
- `docs/evaluation/evidence/alpha.35-der-2.1.32/VF-history.png`
- `docs/evaluation/evidence/alpha.35-der-2.1.32/VF-worker.png`
- `docs/evaluation/evidence/alpha.35-der-2.1.32/VF-schedule.png`

## What's next

Sync module cleanup is now done for a non-technical operator.
Next pass per the roadmap is Workflows / Data, applying the same
hub + humanisation idiom.
