# der-2.3.45 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.44`

## Headline

**Workflow sub-module UI consistency + professional tabbed wizard
detail page.** Approvals and Referral inbox adopt the shared
`ea-screen-header` idiom; opening a workflow for edit now presents a
six-tab detail page (Overview / Steps / Dependencies / Settings /
Pin / Runs) instead of a single scrolling screen.

## 1. Sub-module consistency sweep

| Screen | Before | After |
|---|---|---|
| Approvals (`EAApprovalQueue`) | bare `<h1>` | `ea-screen-header` with title + subtitle |
| Referral inbox (`EAReferralInbox`) | bare `<h1>` + `<p>` | `ea-screen-header` |

Workflows list (`EACaptureWorkflowList`) + Referral history
(`CapReferralHistory`) keep their `SyncStatusBar` because that
widget carries aggregate counters (enabled count, pending vs.
accepted vs. dismissed) — a legitimate alternative to the plain
screen header.

## 2. Wizard detail page (edit mode only)

Opening `/admin/workflows/:id` now renders a tabbed layout:

```
┌──────────────────────────────────────────────────────────┐
│ [Overview] [Steps · roles · devices] [Dependencies]      │
│ [Settings] [Metadata pin] [Runs]                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  <active tab panel>                                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Overview** (default) — editable name field + facts list
  (type · target · status · approval · default device · pin ·
  step count · dependency count · run count). Each count is a
  button that jumps to the matching tab.
- **Steps · roles · devices** — the existing step rows + field
  selector.
- **Dependencies** — the explicit `DependencyEditor`.
- **Settings** — enabled / approval / default device.
- **Metadata pin** — snapshot pin.
- **Runs** (lazy-loaded on first open) — read-only table of
  this workflow's runs with links into the per-run validation page.

Create mode is unchanged — the 3-step walkthrough stays, so
authoring a new workflow still feels guided.

Save-button footer renders on every tab except Overview and Runs
(nothing to save there).

## 3. Verified live

```
Open edit page                       ✓ 6 tabs rendered
Overview panel visible by default    ✓ wiz-overview present
Settings tab                         ✓ wiz-enabled select visible
Runs tab                             ✓ wiz-runs panel renders
page errors                          ✓ 0
Approvals + Referral inbox retrofit  ✓ ea-screen-header added
```

## 4. Files changed

```
admin-ui/src/screens/EACoreScreens.tsx                    — Approvals + Referral inbox
                                                             ea-screen-header
admin-ui/src/screens/workflow/WorkflowWizard.tsx          — tabs state, OverviewPanel,
                                                             RunsPanel, per-tab guards on
                                                             each form-section
admin-ui/src/styles.css                                   — ea-wizard-tabs,
                                                             ea-overview-dl
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.45
```

## 5. Follow-ups

- Deep-link each tab via URL path (`/workflows/:id/overview` etc)
  so the active tab survives reloads and is shareable.
- Make the Overview facts list card-based (one card per fact) once
  design settles.
- Peers tab inside the wizard: "Push this workflow to peers" without
  leaving the detail page.
