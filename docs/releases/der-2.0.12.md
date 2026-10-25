# der-2.0.12 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.11`

## Headline

Second compaction pass for the admin UI — tightens every surface
noticeably closer to the docs/media/ui/* mockup density.

## Changes

CSS-only. No API, routing, or feature changes.

| Element                | Before   | After    | Δ    |
|------------------------|---------:|---------:|-----:|
| Hero height            | 195 px   | 123 px   | −37% |
| KPI tile height        | ~82 px   | 65 px    | −21% |
| Panel head height      | ~44 px   | 35 px    | −20% |
| Hero title             | 24 px    | 20 px    | −17% |
| KPI value              | 20 px    | 16 px    | −20% |
| KPI icon chip          | 34 × 34  | 28 × 28  | −35% |
| Grid gaps              | 12 px    | 8 px     | −33% |
| Components-list rows   | 10 px    | 6 px     | −40% |
| Gauge ring default     | 92 px    | 72 px    | −22% |
| Topology nodes         | min-w 140 + big icons | min-w 100, no icons | tighter |

The Workspace landing page now fits DER status + 5 KPIs + System
topology + Resource usage + the sync chart + conflict review above
the fold on a 1440 × 1100 viewport.

## Verification

- Server reports v2.0.12.
- OU filter cascade still verified end-to-end (484 → 278 →
  1 → 1 → 484).
- 244 / 244 admin-ui tests passing.

Evidence: `docs/evaluation/evidence/alpha.20-compact2/`.
