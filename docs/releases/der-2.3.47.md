# der-2.3.47 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.46`

## Headline

**Workflow module standardised to DER record-management idiom.** Flat
form rewritten without inline styles, sub-module nav icons restored,
status pills converted to quiet-dot chips, and the admin-UI service
worker now uses network-first for the shell so new deploys land on
first reload instead of after a hard-refresh.

## 1. Nav icons on workflow sub-modules

`admin-ui/src/app/navigation.ts` — the workflow group's items were
missing `tabIcon`, so the SectionTabs strip rendered them as text-only
(unlike every other module). Added:

| Item | tabIcon |
|---|---|
| Workflows | `overview` |
| My queue | `data-queue` |
| Peers | `peer` |
| Import inbox | `metadata` |
| Approvals | `attention` |
| Referrals | `activity` |
| Referral history | `history` |

## 2. WorkflowForm rewrite

The flat form shipped in 2.3.46 was correct in structure but visually
distorted — custom one-off classes (`.ea-wf-form-chosen`), inline
styles on `<select>` elements, Unicode expand arrows (▾▸), and an
inline `gridTemplateColumns` for the field grid.

The rewrite:

- All inline styles stripped. New CSS primitives in `styles.css`:
  `.ea-form-footer`, `.ea-input--sm`, `.ea-field-chosen`,
  `.ea-wf-steps-*`, `.ea-wf-fields-*`, `.ea-wf-deps-*`,
  `.ea-queue-controls`, `.ea-peer-auth-user`.
- Expand arrows replaced with `Edit` / `Hide` text buttons
  (`.ea-btn--ghost.ea-btn--sm`) in a dedicated Fields column.
- Chosen-metadata read-back uses `.ea-field-chosen` instead of the
  removed one-off class.
- Footer action row uses the shared `.ea-form-footer` idiom from
  EAUserCreate.
- Type dropdown is disabled in edit mode (metadata binding is
  immutable).
- Dependency editor rows use `.ea-wf-deps-item` and `.ea-input--sm`
  for consistent width.

## 3. HeroHeader across the whole Workflow surface

Replaced the remaining bare `<header className="ea-screen-header">`
blocks with `<HeroHeader title="…" actions={…} />` + a
`.ea-visually-hidden` H1 for a11y, matching the EACoreScreens idiom:

- WorkflowPeers → `HeroHeader title="Peers"`
- WorkflowImportInbox → `HeroHeader title="Import inbox"`
- RunValidation → `HeroHeader` with `← My queue` back action
- SnapshotList → `HeroHeader title="Snapshots"`
- SnapshotDiff → `HeroHeader` with `← Snapshots` back action
- WorkflowQueue → title renamed `My work` → `My queue` to match nav

## 4. Pills → quiet-dot chips (der-2.1.65 standard)

Status indicators converted to `.ea-chip` with tone modifiers:

- WorkflowQueue: `ReadinessPill` → `.ea-chip--success` /
  `.ea-chip--neutral`; validation-count link →
  `.ea-chip--danger`.
- WorkflowImportInbox: status column → `.ea-chip--success` /
  `.ea-chip--danger` / `.ea-chip--neutral`.
- WorkflowPeers: auth state → `.ea-chip--success` /
  `.ea-chip--neutral`.

## 5. Service worker — network-first for the shell

Previously the admin SW was cache-first for every `/admin/*` request,
including `index.html`. A fresh deploy's new asset bundles were
present on the server but the SW kept serving the stale `index.html`
pointing at the old hash — operators saw the previous build until a
hard reload. Fixed by splitting:

- `/admin/assets/*` (hashed, immutable) → cache-first.
- `/admin/*` (shell, including `index.html`) → network-first with
  cache fallback for offline.

New `networkFirst` helper added. Offline behaviour preserved — if the
network is down, the SW falls back to the cached shell.

## 6. Files changed

```
admin-ui/src/app/navigation.ts                        — workflow tabIcons
admin-ui/src/screens/workflow/WorkflowForm.tsx         — full rewrite, no inline styles
admin-ui/src/screens/workflow/WorkflowQueue.tsx        — HeroHeader + chips + .ea-queue-controls
admin-ui/src/screens/workflow/WorkflowPeers.tsx        — HeroHeader + chips
admin-ui/src/screens/workflow/WorkflowImportInbox.tsx  — HeroHeader + chips
admin-ui/src/screens/workflow/RunValidation.tsx        — HeroHeader
admin-ui/src/screens/metadata/SnapshotList.tsx         — HeroHeader
admin-ui/src/screens/metadata/SnapshotDiff.tsx         — HeroHeader
admin-ui/src/styles.css                                — form-footer, wf-steps/fields/deps,
                                                          input--sm, field-chosen, queue-controls
admin-ui/public/sw.js                                  — networkFirst for /admin shell,
                                                          cacheFirst only for /admin/assets
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.47
```

## 7. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.47 bundle
                                               (dist/assets/index-BI228jGn.js,
                                                index-CwOb9eDG.css)
cd admin-ui && npm test -- --run            241 passed, 4 pre-existing CWF-01 fails
cd server && mvn -q -DskipTests package     ✓ der-server-2.3.47.jar
```

## 8. Follow-ups

- Fix the pre-existing CWF-01 RowMenu delete tests (predate the
  RowMenu refactor; delete button is now nested in a popover and
  tests click it directly).
- Live-verify WorkflowForm against the dev DHIS2 instance once an
  ADMIN session is seeded.
