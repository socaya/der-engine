# der-2.1.43 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.42`

## Headline

Finish the Sync module `/sync/data` rebuild — the biggest item deferred
from 2.1.42. The page now follows DER Sync requirements §7 end-to-end:
hero status, big "Push data now" action, six-state summary strip,
spec-matching table columns, type + status filters, and a tabbed
drawer carrying the full payload JSON.

## Changes

### Server

- `OperationJournalRepository.findRecent(limit)` — new query that
  returns the most-recent `operation_journal` rows across any state,
  ordered by `updated_at DESC`. Capped at 500.
- `JournalOperationLookupController` gains a list endpoint:
  `GET /edge-api/v1/journal/operations?limit=N`. Powers the full
  Data table (not just conflicts). Authenticated per the existing
  `/edge-api/v1/**` matcher.

### Admin UI

- `edgeApi.listJournalOperations(limit)` wraps the new endpoint.
- `MockupDataQueues` rewritten per spec §7:
  - **Hero status** mirrors the Overview/Metadata/Worker pattern:
    `"All local data has been sent"` / `"N records waiting to be sent"`
    / `"N records need attention"` / `"Data push is paused"` /
    `"Central DHIS2 is unavailable"`. The right-rail button is a big
    *Push data now* that triggers `JOURNAL_WORKER_DRAIN` and disables
    itself with a muted hint when prerequisites don't hold.
  - **Six-column summary strip** showing current counts for each
    operator state: Waiting · Sending · Sent · Retrying · Rejected ·
    Needs attention. Each tile carries a `data-test="data-summary-*"`
    hook.
  - **Spec-matching table columns**: `[icon] · Type · Record · Captured
    · Status · Last attempt · Action`. Status chips use the operator
    language (never raw backend state), with the raw enum tucked under
    the type label in mono. Row click opens the drawer; row-level
    *Open* button is a non-blocking affordance per the spec.
  - **Type + status filters**: Data type picker uses humanised labels
    (Aggregate data / Single event / Tracker event / Tracked entity /
    Enrollment); status picker uses the six operator-facing states.
    Plus the existing search box over record ref + operation ID.
  - **Drawer** keeps the two-tab layout from 2.1.41 (Overview +
    Payload) but drops the previous separate fetch — the full
    operation (incl. payload JSON) is already in state. The Action
    section now shows the right verb per status: `Retry push`
    (Retrying / Rejected), `Open attention item` (Needs attention),
    `Push now` (Waiting), and nothing (Sent / Sending — nothing left
    to do).
  - Legacy outgoing/incoming tabs removed. Incoming referrals have
    their own home at `/referral/inbox`; mixing them into Data was
    confusing operators.

## Live assertions (all green)

Seeded four rows across four states + the pre-existing sent rows:

| Check                                     | Observed                                                       |
|-------------------------------------------|----------------------------------------------------------------|
| Hero headline (with 2 attention items)    | *"2 records need attention"*                                   |
| Push button label                          | *"Push data now"*                                              |
| Summary tiles                              | Waiting 1 · Sending 0 · Sent 2 · Retrying 1 · Rejected 1 · Needs attention 1 |
| Table head columns                         | `TYPE · RECORD · CAPTURED · STATUS · LAST ATTEMPT · ACTION`    |
| First row                                  | `📊 Aggregate data · AGGREGATE_DATA_VALUE · ANC-U5-WAIT · 24s ago · Waiting · 24s ago · Open` |
| Data-type filter                           | Dropdown with "All data types" + humanised type labels         |
| Status filter                              | Dropdown with "All statuses" + six operator states             |
| Drawer tabs                                | Overview + Payload                                             |
| Payload tab                                | JSON tree with Copy button + Push-now action                   |

Screenshots: `/tmp/der-sync-shots-v2/data.png` and
`data-drawer-payload.png`.

## Remaining Sync module gaps (deferred)

Still to do in a later release (not blockers for the module baseline):

- `/sync/metadata` — per-type update breakdown. Needs a server endpoint
  that reports what the last mirror sync actually changed (programs,
  data elements, OUs, …).
- `/sync/settings` — editable retry/batch/back-off/warning-threshold
  fields. Backend surface already exists under `/settings`; this is
  a UX promotion into Sync-scope.
- Audit log emission for manual actions (`sync.manage` events). Audit
  already fires at the service layer; the UI "Pull / Push / Pause /
  Resume / Retry" buttons need to be wired through the audit path too.
