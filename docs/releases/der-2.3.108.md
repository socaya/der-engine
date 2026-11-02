# der-2.3.108 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.107`

## Headline

**Closed the last four cross-module gaps.** The B/C re-audit turned
up 1 violation + 3 borderline cases; all shipped. Rule is now
fully enforced across every screen inventoried in R-AB.

## 1. R-AC — B/C closure

### Violation fixed

**`MoreScreens.tsx:520`** (SyncWorker screen subtitle)

- **Before**: `Needs attention <Link>{N}</Link>` — the bare count
  itself was the hyperlink. Operators reading the status strip saw
  a number, not an affordance.
- **After**: count stays as plain `<strong>` status text; the
  cross-module jump is a dedicated `Sync › Open attention →` link
  immediately after. Both interactivity and target module are
  visible without needing to hover.

### Borderline cells promoted to explicit

**`DataAggregate.tsx:300`**, **`DataEvents.tsx:319`**, **`DataTracker.tsx:404`**
(workflow-name table cell)

- **Before**: colored text (primary-ink) was the only signal that
  clicking the workflow name opens the Workflows module. No icon,
  no explicit label.
- **After**: trailing `↗` arrow glyph (ink-500) rendered after the
  workflow name; `title="Open workflow run in Workflows module — <kind> · <businessKey>"`
  for keyboard + screen-reader users. The Link now uses
  `display: inline-flex` so the arrow sits inline next to the text,
  not on a wrap.

### Styling restraint

The arrow is a plain Unicode glyph — no new icon added to UiIcon
vocabulary. Keeps the pattern consistent with the shortcut-style
arrows already used in `MoreScreens.tsx` and other Related menus.

## 2. Audit status after R-AC

- **Category A** (R-AB): ✅ cleared.
- **Category B** (Data → `/sync/attention/*`): ✅ 1 violation fixed, 10 compliant sites unchanged.
- **Category C** (Data → `/workflows/.../runs/*`): ✅ 3 borderline sites promoted to explicit.
- **Category D** (Dashboard/Workspace "View All"): ✅ by design.

**Combined inventory: ~85 cross-module links, 9 reshaped across
R-AB + R-AC, 0 remaining violations.**

## 3. Live verification

```
GET /system/health                                 → 200
tsc --noEmit                                        → clean
cd server && ./mvnw -DskipTests package             → der-server-2.3.108.jar
admin-ui bundle                                     → 2.3.108
```

## 4. Files changed

```
admin-ui/src/screens/MoreScreens.tsx                — SyncWorker attention
                                                       → labelled "Sync ›
                                                       Open attention →" link
admin-ui/src/screens/DataAggregate.tsx              — workflow-name cell
                                                       trailing ↗ + title
admin-ui/src/screens/DataEvents.tsx                 — same pattern
admin-ui/src/screens/DataTracker.tsx                — same pattern

VERSION / server/pom.xml / admin-ui/package.json / sw.js  → 2.3.108
```

## 5. Follow-ups

Nothing load-bearing. The rule
*(no hidden cross-module jumps; disclose via RelatedMenu, Status
chip, labelled context menu, or trailing ↗)* is now applied
consistently.

Soft follow-ups for a future round when operators ask:

- Add a `data-cross-module="<target>"` attribute convention + Vitest
  lint rule so future PRs can't reintroduce hidden jumps.
- Review the three screens outside the current audit scope
  (`/approvals/*`, `/referral/*`, `/dhis2/metadata`) with the same
  rule.
- Add aria-label support to the `↗` glyph (currently
  `aria-hidden="true"`); if operators request it we can expose it
  via screen-reader-only text.
