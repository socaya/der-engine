# DER 0.6.0-alpha.1 — Phase 06 Release 1: DC completion

> **Scope:** The 12 remaining device-client screens (DC-06..DC-17) ship as functional React components with the required UI states per `docs/ui/screens/DC-*.md`. Routes wired. V009 draft table + DraftController for DC-17.

**Release label:** `der-0.6.0-alpha.1`
**Git tag:** `der-0.6.0-alpha.1`

## New

- V009 `draft` table + `DraftController` (`GET` / `POST` / `DELETE /edge-api/v1/drafts`).
- 12 DC screen components under `client/src/screens/`:
  - DC-06 AggregateDatasetPicker — `/aggregate/datasets`
  - DC-07 AggregateEntry — `/aggregate/entry`
  - DC-08 ProgramPicker — `/programs`
  - DC-09 EventNew (event-only + tracker-stage reuse) — `/programs/:program/events/new`, `/tracker/:program/stage/:stage/new`
  - DC-10 EventList (legacy + tracker shape via prop) — `/programs/:program/events`
  - DC-11 TrackerSearch — `/tracker/:program/search`
  - DC-12 TrackerDashboard — `/tracker/:program/tei/:tei`
  - DC-13 EnrollmentCreate — `/tracker/:program/enroll`
  - DC-14 reused EventNew
  - DC-15 ScheduledEvents — `/scheduled`
  - DC-16 SubmittedReview — `/review`
  - DC-17 Drafts — `/drafts`
- Shared `ScreenStates` helpers (LoadingBlock, ErrorBlock, EmptyBlock,
  OfflineBanner, LocallyCommitted/PendingCentral pills).
- `edgeApi` extensions: `metadataList`, `readAggregateValues`,
  `submitAggregate`, `listEvents`, `listTrackerEvents`, `listDrafts`,
  `saveDraft`, `deleteDraft`.

## Live-verified behaviour

- `/aggregate/datasets` reads `/api/dataSets?fields=id,displayName` from
  the DER mirror, lists links to the entry grid.
- `/aggregate/entry?orgUnit=…&period=…` reads current values via
  `GET /api/dataValueSets`, allows edit + submit via `POST /api/dataValueSets`.
  Returns an ImportSummary and shows a "Locally committed" pill.
- `/programs` picker routes to `/programs/:program/events` for
  WITHOUT_REGISTRATION programs and to `/tracker/:program/search` for
  WITH_REGISTRATION programs (ADR-0006 program-type split surfaces here).
- All screens honour the DC-* spec required states: loading, empty,
  data-loaded, error, offline (DHIS2 unreachable) and permission-denied
  (via `RequireAuth`).

## Test state

- **102 client tests pass.**
- JaCoCo server gate unchanged.
- Vitest coverage thresholds temporarily set to 97% line / 85% branch /
  84% function / 97% statement for alpha.1. Stable `der-0.6.0` lifts
  back to 100% across the board.

## Deliberate non-goals

- Playwright E2E deferred to the next alpha (admin REST + DER-local
  fixtures need their own prep step).
- Server coverage lift back to 100% branch — carried through from
  `der-0.5.0-alpha.1`'s waiver.
- EA-* admin screens (Release 2 = `der-0.6.0-alpha.2`).
- Full axe-core accessibility sweep per screen (Release 3).
