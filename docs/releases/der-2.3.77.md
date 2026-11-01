# der-2.3.77 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.76`

## Headline

**Admin shell brand (sidebar + header) now uses the official DER
SVG instead of the legacy PNGs.**

## 1. What changed

`AdminShell` has three brand slots. All three swapped away from
`/admin/der-logo*.png` to the SVG set shipped in 2.3.76:

| Slot | Was | Now |
|---|---|---|
| Sidebar (expanded) | `/admin/der-logo.png` | `/admin/assets/der-logo.svg` |
| Sidebar (collapsed) | `/admin/der-logo-short.png` | `/admin/assets/der-icon.svg` |
| Header brand link | `/admin/der-logo.png` | `/admin/assets/der-logo.svg` |

Old `admin-ui/public/der-logo.png` + `der-logo-short.png` deleted.

## 2. Files changed

```
admin-ui/src/components/AdminShell.tsx                   — 3 brand <img>
                                                             src swapped
admin-ui/public/der-logo.png                             — DELETED
admin-ui/public/der-logo-short.png                       — DELETED
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.77
```

## 3. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.77 bundle (832 ms)
```

## 4. Follow-ups

- Swap `_exact.svg` to the lighter `_vector.svg` variants if the
  ~900 KB brand file becomes a measurable issue.
