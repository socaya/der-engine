# der-2.1.73 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.72`

## Headline

Consistency sweep across the Workflows / Backup / Restore /
Audit screens: last chip-pills migrated to the quiet `Status`
marker, Backup + Restore history tables gain pagination, and
Workflow catalogue actions pick up the standard icon pattern.

## Changes

### Workflow catalogue (`/workflows`)

- **Enabled column** — `.ea-chip ea-chip--success/neutral` →
  `<Status tone>` marker (dot + tone-coloured text).
- **"New workflow" button** — `UiIcon icon="plus"` prefix added
  for consistency with every other primary action in the admin
  UI.
- **"Delete" row button** — `UiIcon icon="trash"` prefix added.

### `/backup` runs table

- **Status column** — chip pill → `<Status tone>` marker.
- **Kind column** — info chip → plain bold text; kind doesn't
  need tone colouring, it's just a label.
- **Pagination** — new `BackupRunsTable` helper component wraps
  the rows in `usePaged(25)` + `<TablePager>`.

### `/restore` history table

- **Status column** — chip pill → `<Status tone>` marker.
- **Pagination** — new `RestoreRunsTable` helper with
  `usePaged(25)` + `<TablePager>`.

### `/audit/events` timeline

- **Outcome column** — chip pill → `<Status tone>` marker.
  `SUCCESS` renders a quiet green tick + text; `FAILURE` renders
  danger-ink; everything else info-ink.

## Why

Every list screen in the admin UI now:

- Caps rendered rows at 25 (shared `usePaged` + `TablePager`).
- Shows status/outcome columns via the `<Status>` marker — no
  background-filled pills on module pages, matching the user's
  "no chip styles" direction from 2.1.65.
- Carries icons on primary action buttons where sensible.

That's the full consistency contract applied uniformly across
Workflows, Backup, Restore, Audit, Sync, Data, Users, Devices,
Approvals, Referrals, Metadata, Compatibility, Workspace,
Dashboard.

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.73 JAR built
Server serves 2.1.73           ✓
```
