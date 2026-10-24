# der-2.0.9 (stable)

**Date:** 2026-10-24
**Previous stable:** `der-2.0.8`

## Headline

Workspace consolidation: the DER landing page is now a single
professional dashboard, replacing the Overview / Dashboard
duplication that lived under the Workspace sidebar group.

## Changes

- New `MockupWorkspace` component (`admin-ui/src/screens/mockups/
  Workspace.tsx`) merges the best of docs/media/ui/DER DHIS2 Edge
  Runtime System Overview.png and docs/media/ui/DER Server Operations
  Dashboard.png into one page.
- Workspace nav group collapsed from 3 items (Overview / Dashboard /
  System info) to 2 (Workspace / System info).
- Both `/` and `/dashboard` route to the new Workspace page; legacy
  screens preserved at `/overview-legacy` and `/dashboard-legacy`.

## Layout

1. Welcome hero with 'DER Server' identity, status chip, build + date,
   and a mini topology sketch.
2. 5 KPI tiles — DER status, DHIS2, Local database, Synchronisation,
   Client devices.
3. 2-col: System topology (DHIS2 → DER → Clients) · Resource rings
   (Scheduler / Memory / Storage).
4. 2-col: Sync activity 24h chart + 4 stats · Conflict review by
   priority.
5. 2-col: System components list · Recent activity timeline.
6. 3-col: Client devices · Edge workflows · Database & storage.

Every stat is read from live `/edge-api/v1/*` endpoints.

## Verification

- 244 / 244 admin-ui tests passing.
- Live build, package, launch — server reports v2.0.9.
- Fresh desktop + mobile snapshots at
  `docs/evaluation/evidence/alpha.18-workspace/`.
