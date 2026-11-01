# der-2.3.76 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.75`

## Headline

**Official DER brand SVG on the topology card + rebalanced layout —
logos left-aligned, status markers right-aligned, redundant text
dropped.**

## 1. Asset swap

- `admin-ui/public/assets/der-logo.svg` ← `docs/media/DER_logo_exact.svg`
  (brand mark + "DER" wordmark, 3:1 ratio, 983 KB).
- `admin-ui/public/assets/der-icon.svg` ← `docs/media/DER_icon_exact.svg`
  (icon-only, 1:1 ratio, 907 KB) — available for any icon-only
  context that comes up later (header, favicon slot, empty-states).
- Old `der-logo.png` removed.

> **Note on file size:** both `_exact.svg` files embed a PNG as
> base64 so they are visually faithful to the source but ~900 KB
> each. They cache on first request and never re-download, but if
> this becomes a problem the smaller `DER_icon_vector.svg` (7 KB)
> and `DER_logo_vector.svg` (49 KB) in `docs/media/` are true
> vector exports and swap in trivially.

## 2. DerCard layout

Redesigned the central DER card:

```
┌──────────────────────────────────────┐
│  [DER logo, 40 high, left-aligned]  ●│   ← status marker top-right
│  Facility Server · Edge Runtime      │   ← quiet caption
└──────────────────────────────────────┘
```

- The logo is left-aligned at 40 px tall, max width (card − status
  room) so the brand reads cleanly without clipping.
- Separate "DER Edge Runtime" title removed — the wordmark is
  already in the logo. Replaced with a single quiet caption
  `Facility Server · Edge Runtime` so the viewer still has
  context.
- Status marker remains top-right so it reads independently.

## 3. WanBubble layout

Rebalanced to match: logo left, status badge right.

```
╭──────────────────────────────────────╮
│  [DHIS2 logo, 32 high]            ●  │
╰──────────────────────────────────────╯
```

- `justify-content: space-between` instead of `center`.
- DHIS2 logo bumped from 28 px → 32 px for better legibility now
  that it's not fighting the status badge for centre space.

## 4. Files changed

```
admin-ui/public/assets/der-logo.svg                      — NEW (replaces .png)
admin-ui/public/assets/der-icon.svg                      — NEW (icon-only variant)
admin-ui/public/assets/der-logo.png                      — DELETED
admin-ui/src/components/network/NetworkNode.tsx          — DerCard rebuilt;
                                                             WanBubble rebalanced
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.76
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.76 bundle (808 ms)
                                              dist/assets/der-logo.svg ✓
                                              dist/assets/der-icon.svg ✓
                                              dist/assets/dhis2-logo.svg ✓
```

## 6. Follow-ups

- Swap to `_vector.svg` variants if page-load weight becomes a
  concern.
- Wire `der-icon.svg` into the admin shell header once the sidebar
  gets a brand slot (currently it uses the text wordmark).
