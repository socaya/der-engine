# der-2.3.78 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.77`

## Headline

**Topology logos centred on their cards; sidebar brand left-aligned,
scaled up, surrounding whitespace clipped.**

## 1. Topology

- **DerCard** — logo + "Facility Server · Edge Runtime" caption
  now centred horizontally. Status marker stays pinned top-right
  via absolute positioning.
- **WanBubble** — DHIS2 logo centred in the pill; status badge
  pinned top-right absolute instead of competing with the mark
  for horizontal space.

## 2. Sidebar brand

The `.ea-sidebar-brand` strip in the left top bar is reworked:

- `justify-content: flex-start` + `padding: 4 10 4 14` so the
  mark sits flush left.
- `.ea-sidebar-logo-img` height bumped from `topbar - 8` to
  `topbar - 10`, with a mild `transform: scale(1.15)` anchored at
  `left center` to compensate for the internal margin baked into
  the exact SVG export. The container's `overflow: hidden` clips
  any whitespace that falls off the right edge.
- Icon-only variant for the collapsed sidebar (≤1024 px) kept
  centred; existing media-query rule unchanged.

Visually: the DER wordmark now reads immediately from the left
edge of the sidebar instead of floating inside a half-empty strip.

## 3. Files changed

```
admin-ui/src/components/network/NetworkNode.tsx          — DerCard + WanBubble
                                                             logos centred;
                                                             status badges
                                                             absolute top-right
admin-ui/src/styles.css                                  — .ea-sidebar-brand
                                                             + .ea-sidebar-logo-img
                                                             left-align + scale
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.78
```

## 4. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.78 bundle (820 ms)
```

## 5. Follow-ups

- Swap exact-SVG to the lighter vector variants (`_vector.svg`)
  if the ~900 KB brand file becomes a measurable cold-start cost.
