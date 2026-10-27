# der-2.1.48 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.47`

## Headline

Review feedback on Workflows nav:

> "Do we need `/admin/workflows/runs` or as an action to a workflow
> added? We may not need to have it on its own list, but as part of the
> details of a workflow."

Agreed. **Runs and Assignments are no longer top-level sidebar items.**
Both are now reached from the Workflows catalogue — each row shows a
Steps count and a Runs count, each linking into the respective view
scoped to that single workflow. The routes still work (so existing
bookmarks / direct URLs don't break), and the global "all workflows"
view is still available if accessed directly without a `?workflow=`
query param.

## Changes

### `admin-ui/src/app/navigation.ts`

- `/workflows/runs` and `/workflows/assignments` flipped from
  `implemented` → `contextual`, so they drop out of both the sidebar
  and the Workflows section-tabs strip.
- Workflows section tabs now read: `Workflows · Approvals · Referrals
  · Referral history`.

### `admin-ui/src/screens/EACoreScreens.tsx` — `EACaptureWorkflowList`

- Added `Steps` and `Runs` columns to the catalogue, between `Version`
  and `Enabled`.
- Steps count is now a link to `/workflows/{id}#assignments` (the
  Designer page anchored at the Assignments section).
- Runs count is a link to `/workflows/runs?workflow={id}` — the
  scoped runs view.
- `listWorkflowRuns` is fired in parallel per workflow on load so the
  catalogue populates its Runs column from live data.

### `admin-ui/src/screens/CapabilityScreens.tsx`

- `CapWorkflowRuns`: reads `?workflow=<id>` from the URL. When
  present, the status bar switches to `{Workflow name} · Runs` and
  shows a `← Back to workflows` link in the subtitle; only runs for
  that workflow are fetched. Without the param, the page behaves as
  before — a global view across every workflow.
- `CapStepAssignments`: same treatment — `?workflow=<id>` scopes the
  table to one workflow, hides the "Workflow" column (redundant), and
  swaps the subtitle for a Back-to-workflows breadcrumb.

## Live assertions (all green)

Playwright-verified against the running local DER with a seeded test
workflow (2 steps, 0 runs):

| Check                                                          | Observed |
|----------------------------------------------------------------|----------|
| Workflows section tabs                                          | `Workflows · Approvals · Referrals · Referral history` (no Runs / Assignments) |
| Catalogue thead                                                 | `NAME · BINDING · VERSION · STEPS · RUNS · ENABLED · ACTION` |
| Row for seeded workflow                                         | `ANC Monthly Report · DATA_SET:DS_ANC · v1 · 2 · 0 · Enabled · Delete` |
| Steps link `href`                                               | `/admin/workflows/{id}#assignments` |
| Clicking Runs link                                              | navigates to `/workflows/runs?workflow={id}` |
| Scoped runs page H1                                             | `ANC Monthly Report · Runs` |
| Scoped runs page has `← Back to workflows` link                 | ✓ |
| Global runs page (no `?workflow=`) still renders                | H1 `Workflow runs None yet` |

Screenshots: `/tmp/der-wf-nav/01-catalogue.png`, `02-scoped-runs.png`.
