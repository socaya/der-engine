# der-2.0.15 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.14`

## Headline

Icon cleanup — remove the colored soft-tint chip backgrounds behind
every page icon so the glyphs stand on their own; grow glyph size
across the UI.

## Changes

CSS only.

- `.ea-kpi-tile-icon`  — background transparent; container 36 → 28;
  svg 18 → **24**; stroke-width 1.8.
- `.ea-health-icon`    — background transparent; container 32 → 28;
  svg 24; stroke-width 1.8.
- `.ea-quick-icon`     — background transparent; container 36 → 28;
  svg 24; stroke-width 1.8.
- `.ea-link-tile-icon` — background transparent; container 32 → 24;
  svg 22; stroke-width 1.8.

Semantic colour kept per variant (navy / teal / amber / green /
danger-ink) so KPI tiles still signal state at a glance — just as a
coloured line glyph instead of a coloured tile.

Letter-mark avatars (`.ea-app-icon`, `.ea-user-cell-avatar`) left
untouched — those are intentional visual initials, not icon chips.

## Verification

- 244 / 244 admin-ui tests passing.
- Live: KPI icon computed `background-color` = `rgba(0,0,0,0)`;
  SVG bounding box = **24 × 24** (was 18 × 18, +33%).

Evidence: `docs/evaluation/evidence/alpha.25-icons/`.
