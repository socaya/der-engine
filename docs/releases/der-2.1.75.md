# der-2.1.75 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.75`

## Headline

Screen-state primitives (`ErrorBlock`, `EmptyBlock`,
`OfflineBanner`) ported from `@dhis2/ui`'s `NoticeBox` surface
onto a DER-native quiet block. The old blocks had hard-filled
soft-coloured backgrounds that fought with the rest of the admin
chrome; the new blocks render as `[icon] [title / body]` with a
tone-coloured left border and no fill.

## Before vs after

### Before — @dhis2/ui NoticeBox

```
┌───────────────────────────────────────────────┐
│ Error / Warning / Info soft background        │
│ ▌ Title                                       │
│ ▌ Body text in the same soft-filled card      │
└───────────────────────────────────────────────┘
```

Three soft background colours (success / warning / error) sat
inside the DER screen chrome like a different design system —
because they were.

### After — DER-native state block

```
▌ [icon]  Title
▌         Body text, same tone as the border
```

- Left-side 3 px border carries the tone (danger-ink / warning-ink /
  muted border-strong).
- Icon tinted the same tone.
- Title + body plain text; no fill.
- Still screen-reader-labelled (role="alert" for errors,
  role="status" for offline).

## New CSS

```css
.ea-state-block{
  display:flex;align-items:flex-start;gap:12px;
  padding:14px 16px;margin:0 0 var(--sp-4);
  border-left:3px solid var(--der-border);
  background:var(--der-surface);
}
.ea-state-block-title{font-size:15px;font-weight:600;color:var(--der-ink-900)}
.ea-state-block-content{font-size:14px;color:var(--der-ink-700)}
.ea-state-block--danger  { border-left-color: var(--der-danger-ink)  }
.ea-state-block--warning { border-left-color: var(--der-warning-ink) }
.ea-state-block--muted   { border-left-color: var(--der-border-strong) }
```

Icon vocabulary added:

| Block type | Icon |
|---|---|
| ErrorBlock | `attention` (triangle + dot) |
| EmptyBlock | `overview` (dashboard grid — neutral placeholder) |
| OfflineBanner | `compat` (plug — Central connection) |

## Playwright verification

```
Workflows (empty) → ea-state-block present: true
                    background: rgba(0, 0, 0, 0) (transparent)
                    border-left-color: tone-ink (danger / warning / muted)
```

Screenshot `/tmp/der-2.1.75-empty.png` — the empty-workflows
block now reads as:

```
▌ [grid]  No workflows yet
▌         Click New workflow to configure the first one.
```

Same visual register as the SyncStatusBar + Status markers that
dominate every other DER screen.

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.75 JAR built
Server serves 2.1.75           ✓
Playwright render check       ✓ /workflows empty state renders quietly
```
