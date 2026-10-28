# der-2.1.71 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.70`

## Headline

Round-out release:

1. **Confirmation prompts on every detail-page destructive
   action.** Attention/Approval/Referral detail buttons now
   route through `confirmThenRun` with explicit effect text —
   matching the row-menu behaviour from 2.1.57.
2. **Worker Pause / Resume gets an icon + confirmation.** Also
   switched to the `pause`/`play` UiIcon glyphs.
3. **`/sync/schedule` gets the standard screen header.** Was a
   bare float-right Save button at the top; now a proper
   SyncStatusBar with the flow count inline and a save-icon
   button.

## 1. Confirmation on detail-page actions

Three detail pages had their primary action buttons wrapped
with `confirmThenRun`:

### `/sync/attention/:operationId` (MockupConflictDetail)

```
Accept the local version of {entityType} "{entityRef}"?
It will be queued for Central DHIS2.

Reject the local version of {entityType} "{entityRef}"?
The record will be dropped.
```

### `/approvals/:operationId` (MockupApprovalDetail)

```
Approve {entityType} "{entityRef}"? It will be queued for sync
to Central DHIS2.

Reject {entityType} "{entityRef}"? The record will not be sent
to Central DHIS2.
```

### `/referral/inbox/:inboxId` (MockupReferralDetail)

```
Accept referral "{sourceRef}" and import it locally?

Dismiss referral "{sourceRef}"? It will be marked as handled
on this edge.
```

Row-menu variants of these actions already carried the prompt
from 2.1.57; the detail-page variants now match.

## 2. Worker Pause / Resume

The `/sync/worker` toggle button:

- **Icon** — `pause` (vertical bars) when running,
  `play` (triangle) when paused.
- **Confirmation prompts**:

```
Pause the sync worker? Captured records will keep queueing
locally but nothing will be sent until it resumes.

Resume the sync worker? It will start draining the local queue
to Central DHIS2.
```

Playwright: `data-test="ea14-toggle"` carries an SVG icon.

## 3. `/sync/schedule` header

### Before

A single float-right "Save schedule" button at the top of the
screen with no page title, no context, no icon.

### After

Standard `SyncStatusBar`:

```
Schedule · ● 1 scheduled flow                  [↻ Save schedule]
When each background flow runs. The exact cron expression is
editable per row.
```

Playwright: `h1` reads `"Schedule 1 scheduled flow"`.

## Build + test

```
tsc -b && vite build         ✓ 1733 modules
./mvnw -q -DskipTests package  ✓ 2.1.71 JAR
Playwright worker + schedule   ✓ icon + header checks pass
```
