# der-2.3.75 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.74`

## Headline

**Real DER + DHIS2 brand logos on topology nodes instead of glyphs.**

## 1. Logo assets

Two brand assets copied from `docs/media/` into
`admin-ui/public/assets/` so Vite bundles them into
`/admin/assets/`:

- `der-logo.png`      — DER mesh/stack mark (680 KB, from
                        `logo-short.png`).
- `dhis2-logo.svg`    — DHIS2 brand mark + "dhis2" wordmark
                        (2.7 KB, from `dhislogo.svg`).

Loaded via `<img src=…>` inside each node's `foreignObject`, with
the path prefixed by the Vite base (`__DER_ADMIN_BASE__`) so they
resolve correctly whether served from `/admin/` in prod or `/` in
dev.

## 2. Node changes

- **DerCard** — the generic `facility-server` glyph is replaced
  with the DER mark (28 px tall, auto width, object-fit contain).
  The "DER Edge Runtime" + "Facility Server" labels stay.
- **WanBubble** — the "Central DHIS2" text block + separate badge
  is replaced with the full DHIS2 logo (brand mark + wordmark)
  rendered 28 px tall next to the status badge. The pill is
  slightly wider (rx 110 vs 90) so the logo + badge fit without
  compressing the mark. The ellipse still signals "cloud / WAN
  endpoint" shape-wise, now reinforced by the real brand.

Other node glyphs (device form factors, peer icon, router/switch
icon for Internet) are unchanged — they're function icons, not
product brands.

## 3. Files changed

```
admin-ui/public/assets/der-logo.png                      — NEW (copied from docs/media)
admin-ui/public/assets/dhis2-logo.svg                    — NEW (copied from docs/media)
admin-ui/src/components/network/NetworkNode.tsx          — DerCard uses der-logo.png;
                                                             WanBubble uses dhis2-logo.svg
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.75
```

## 4. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.75 bundle (997 ms)
                                              dist/assets/der-logo.png + dhis2-logo.svg present
```

## 5. Follow-ups

- Consider trimming `der-logo.png` to a smaller optimised PNG (680
  KB is large for an inline topology icon).
- Light/dark variants if the UI picks up a dark theme later.
