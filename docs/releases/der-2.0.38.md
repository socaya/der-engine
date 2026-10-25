# der-2.0.38 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.37`

## Headline

Modernised the Organisation-unit page. The binding details now
read as a rich interactive card with chips, breadcrumbs, stats
and clipboard actions, and the Rebind form is reveal-on-action
instead of always on. Opening it is a deliberate click, not an
accidental scroll past.

## Changes

### `admin-ui/src/screens/CapabilityScreens.tsx` — `CapOrgUnitBinding`

**Current binding card (shown when bound)**

Replaced the plain `DefinitionCard` with an interactive block:

- Big H2 facility name + `bound` chip + `Level N` chip.
- Breadcrumb render of the OU path UIDs
  (`ZEzf44yY3Kd › T4LOE9sCyZR › QLtB3RDivZc › HLZzXaIULBe`).
- Top-right **Copy UID** / **Copy path** buttons wired through
  `navigator.clipboard.writeText` with a 2-second success
  toast (`UID copied to clipboard`).
- 4 stat tiles with colored left borders: DHIS2 UID · Hierarchy
  depth · Bound at (humanized `Oct 24, 2026, 09:00 PM`) · Bound
  by.

**Reveal-on-action Rebind form**

- Hero now carries a single **Change organisation unit** primary
  button. The filter grid + OU select + confirm toggle +
  Apply / Reset actions all stay hidden until that button is
  clicked.
- Opening the form hides the Change button and reveals a
  **Cancel** button that resets `sel`, `confirmRebind`, `query`
  and the three filter dropdowns before closing again.
- When this edge is not yet bound, the form auto-opens so first-
  time binding doesn't dead-end on a disabled Change button.
- The confirm-rebind flag copy is rephrased from "I understand
  this clears mirrored state" to "I understand this clears
  mirrored metadata and journal state" so the risk is clear
  before the operator ticks it.
- Apply button label now reads **Apply rebind** on an edge
  that's already bound (vs plain "Bind" on first bind).

### State additions

- `msg` + a two-second clearing timer for inline success toasts
  (clipboard copies and successful bind both reuse it).
- `rebindOpen` boolean controlling the form reveal.
- `fmtBindAt` helper that formats ISO timestamps as
  `Oct 24, 2026, 09:00 PM` using `toLocaleString`.

## Live verification (15 assertions, all green)

| Check                                             | Observed                                               |
|---------------------------------------------------|--------------------------------------------------------|
| Hero title                                        | `Organisation unit`                                    |
| `Change organisation unit` button on load         | present                                                |
| Rebind form on load                               | hidden (reveal-on-action)                              |
| Binding card                                      | renders with name `A&A Medcare Medical Centre/Clinic`  |
| Copy UID button                                   | present                                                |
| Copy path button                                  | present                                                |
| Clipboard after Copy UID                          | `HL2zXaIULBe` (facility UID)                           |
| After Change click: rebind form                   | visible                                                |
| After Change click: Change button                 | hidden                                                 |
| After Change click: Cancel button                 | visible                                                |
| After Cancel: rebind form                         | hidden                                                 |
| After Cancel: Change button                       | restored                                               |
| OU-list filter cascade                            | 484 total → 278 at level 4                             |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.37/V237-ou-collapsed.png`
+ `V237-ou-rebind-open.png`.
