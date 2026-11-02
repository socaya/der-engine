# der-2.3.92 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.91`

## Headline

**R-C/2.2 — Row-detail pages for aggregate / event / TEI. Click a
row in any Data browse to see its full state, data values,
workflow lineage, and sync history.**

## 1. Three new endpoints

### `GET /edge-api/v1/data/aggregate/{valueId}`

Returns the single aggregate value joined with resolved
`metadata_data_element` / `metadata_data_set` /
`metadata_organisation_unit` / `capture_workflow_run` /
`capture_workflow` / `edge_user` names, plus the
`operation_journal` history (newest 20 rows) for the row's
compound key.

### `GET /edge-api/v1/data/events/{eventId}`

Returns the event header (with resolved program + stage + org-unit
+ workflow + captor names), the full `event_data_value` child-table
flattened to `(dataElementUid, dataElementName, valueText)`, and
the `operation_journal` history keyed on `entity_type='EVENT'`.

### `GET /edge-api/v1/data/tracker/tei/{teiUid}`

Three-way join: the TEI header (type / orgUnit / attributes JSON /
workflow lineage), all `edge_enrollment` rows for the TEI (each
with its own program + workflow link), and all `edge_tracker_event`
rows across those enrolments (joined to program + stage names).

All three queries LEFT JOIN mirror metadata so the detail renders
useful names even for IDs the browse screens show as raw UIDs.

## 2. Three new admin screens

| Route                              | Screen                 |
|------------------------------------|------------------------|
| `/data/aggregate/:valueId`         | `DataAggregateDetail`  |
| `/data/events/:eventId`            | `DataEventDetail`      |
| `/data/tracker/tei/:teiUid`        | `DataTeiDetail`        |

Each screen renders:

- Breadcrumbs through `Data › <section> › <row>`.
- `SyncStatusBar` header with the row's primary identity and a
  **Back to <section>** action.
- A **Row** panel with resolved names + raw UIDs in a muted mono
  caption so the admin can still copy IDs for logs / tickets.
- A **Workflow run** link that uses the standard
  `WorkflowRunLink` helper (`SYS` chip + name + business key).
- Shared **Sync history** panel showing the 20 most-recent
  `operation_journal` entries for the row's entity key, with a
  colour-coded state chip that deep-links to
  `/sync/attention/:operationId`.

The event detail additionally renders a **Data values** panel; the
TEI detail renders **Attributes** + **Enrolments** + **Tracker
events** panels so one page shows a patient's whole facility
history.

## 3. Row-click navigation

The three browse screens (`DataAggregate`, `DataEvents`,
`DataTracker`) now have **clickable rows**. A row click navigates
to the detail page unless the click landed on an in-row link or
button (sync-chip, workflow-link, "zoom TEI" button). The hover
highlight that already applied to `.ea-table--dense` provides the
affordance.

For tracker rows, enrolment + event rows navigate to the owning
TEI's detail page (since there's no dedicated enrolment / event
detail screen in R-C/2.2 — those surfaces are smaller use cases
that stay inside the TEI view).

## 4. Shared helpers factored out

`DataAggregateDetail` exports three reusable primitives used by
all three detail pages:

- `DefRow` — `<dt>/<dd>` with the standard DER padding.
- `WorkflowRunLink` — `SYS` chip + name + business-key caption,
  deep-link to `/workflows/monitoring/runs/:runId`.
- `JournalPanel` — the sync history table.
- `humaniseState` / `toneForState` — colour vocabulary for sync
  state chips.

`DataEventDetail` and `DataTeiDetail` import them directly.

## 5. Files changed

```
server/.../web/DataModuleController.java              — aggregateDetail,
                                                        eventDetail, teiDetail,
                                                        journalFor helper

admin-ui/src/api/edgeApi.ts                           — LocalAggregateDetail,
                                                        LocalEventDetail,
                                                        LocalTeiDetail,
                                                        JournalHistoryEntry +
                                                        three getters
admin-ui/src/screens/DataAggregateDetail.tsx          — NEW screen + shared
                                                        helpers
admin-ui/src/screens/DataEventDetail.tsx              — NEW screen
admin-ui/src/screens/DataTeiDetail.tsx                — NEW screen
admin-ui/src/screens/DataAggregate.tsx                — row click → detail
admin-ui/src/screens/DataEvents.tsx                   — row click → detail
admin-ui/src/screens/DataTracker.tsx                  — row click → TEI detail
admin-ui/src/App.tsx                                  — three new routes

VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.92
```

## 6. Verified

```
cd server   && mvn -q -DskipTests compile    ✓ clean
cd admin-ui && npx tsc --noEmit              ✓ clean
cd admin-ui && npm run build                 ✓ 2.3.92 bundle (808 ms)
```

## 7. Follow-ups

- **R-C/3.1** — Central-DHIS2 download for tracker (hit
  `/api/trackedEntityInstances` on Central; cascade TEI → enrol
  → events into the local store with CENTRAL_DOWNLOAD lineage).
- **R-C/pick-lists** — populate pull dialogs from local mirror
  (programs, dataSets, orgUnits) instead of free-text UIDs.
- Row-detail enhancements:
  - Journal-row click → full operation payload drawer.
  - Enrolment / event dedicated detail screens
    (`/data/tracker/enrollment/:uid`, `/data/tracker/event/:uid`).
  - Retry / resend actions on retryable journal rows.
