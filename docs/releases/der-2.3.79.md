# der-2.3.79 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.78`

## Headline

**R-A — cross-module round-trips + breadcrumbs for DHIS2 / Sync /
Network / Workflows drill-down pages.**

Round-trip exits, context breadcrumbs and a device-detail Related
Activity panel wire the four modules together so admins no longer
land on a drill-down with no obvious way back or sideways.

## 1. New shared `Breadcrumbs` component

Added to `screens/shared.tsx`. Trail renders as
`Section › Subsection › This page`. Linked items use `Link`; the
last item is muted/unlinked current context. Rendered above the
screen's `SyncStatusBar`.

```ts
<Breadcrumbs items={[
  { label: 'Workflows',  to: '/workflows' },
  { label: 'Monitoring', to: '/workflows/monitoring' },
  { label: `Run ${runId.slice(0,8)}` },
]} />
```

## 2. Drill-down pages wired

### WorkflowRunDetail — `/workflows/monitoring/runs/:runId`

- Trail: `Workflows › Monitoring › {workflowName or Run #abc}`.
- "Back to Monitoring" button removed (breadcrumb covers it).
- Actions now carry round-trip exits: **Workflow definition** ·
  **Sync queue** · **Sync attention**.

### MockupSyncHistoryDetail — `/sync/history/:runId`

- Trail: `Sync › History › {category} · Run {runId}`.
- `BackLink` dropped (breadcrumb covers it).
- Actions carry round-trip exit: **Workflow monitoring**.

### MockupDeviceDetail — `/devices/:deviceId`

- Trail: `Devices › {displayName or Device #abc}`.
- Custom `<header className="ea-screen-header">` replaced with the
  standard `SyncStatusBar` (tone, title, subtitle, actions) for
  visual consistency with every other drill-down page.
- New **Related activity** panel at the bottom with 4 soft
  cross-link cards (Sync queue · Sync attention · Workflow
  monitoring · Network client row). Each card is a styled `Link`
  so keyboard navigation works and the destination hint reads at
  a glance.

## 3. Known limits (follow-ups)

The cross-link actions and the Related activity panel are **soft**
exits — they open the destination module index. True data-driven
drilling (e.g. "show only operations produced by this workflow run"
or "operations submitted by this device") needs schema work:

- Add `workflow_run_id` + `submitted_device_id` columns to
  `operation_journal` and populate on enqueue.
- Add server-side filters `?workflowRunId=…` /
  `?deviceId=…` to the journal + sync-job APIs.
- Switch client cross-link URLs to carry the filter.

Scoped out of R-A so the UX wiring ships now; the data link is
sequenced in follow-up R-A-data.

## 4. Files changed

```
admin-ui/src/screens/shared.tsx                          — Breadcrumbs component
admin-ui/src/screens/workflow/WorkflowRunDetail.tsx      — trail + cross-link actions
admin-ui/src/screens/SyncHistory.tsx                     — trail + Workflow
                                                             monitoring exit;
                                                             BackLink dropped
admin-ui/src/screens/MoreScreens.tsx                     — device detail header
                                                             standardised; trail;
                                                             DeviceRelatedActivity
                                                             panel
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.79
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.79 bundle (772 ms)
cd admin-ui && npm test                     ✓ 245/249 (4 pre-existing CWF-01
                                              RowMenu delete failures unrelated)
```

## 6. Follow-ups

- R-A-data: schema + server filters for genuine cross-module
  drill-down.
- R-B: Workflow Monitoring conflict panel links to
  `/sync/attention/:operationId`; Device ↔ Network two-way (P2-4,
  P2-5).
- R-C: Nav balance + Snapshots relocation (P2-6, P2-7).
- Pre-existing CWF-01 RowMenu delete tests.
