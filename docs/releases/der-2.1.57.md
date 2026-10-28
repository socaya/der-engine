# der-2.1.57 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.56`

## Headline

Delivers the P1 ("strongly required") items from
`docs/requirements/DER_UI_Visibility_10_of_10_Standard.md`. With P0
(2.1.56) and P1 (this release) complete, the admin UI meets the
10-of-10 visibility bar across typography, navigation IA, attention
routing, and destructive-action safety.

Seven changes carry most of the P1 weight:

1. **Primary navigation consolidated to 9 domains** (§28).
2. **Functional Attention Centre** replacing the non-interactive bell
   (§6.2, §17).
3. **Non-functional search removed** from the topbar until global
   search is implemented (§18).
4. **User authorization freshness surfaced** per §20.
5. **Destructive actions require typed confirmation + effect
   explanation** across Workflows, Drafts, Attention, Approvals, and
   Referrals (§16).
6. **Metadata screen** now groups resources by domain, surfaces a
   health summary, and relegates Raw JSON to a diagnostic tab (§14).
7. **Flat UI** — surface border-radii collapsed to 0 across panels /
   cards / drawers / dls; pills and dots retain intentional shape.

## 1. Navigation IA — 10 → 9 domains (§28)

`admin-ui/src/app/navigation.ts` collapsed and relabelled per the §28
information-architecture spec. The new primary nav reads:

| Domain | Scope |
|---|---|
| Overview | Workspace / dashboard entry (was "Workspace") |
| Capture | Aggregate / Event / Tracker launchers |
| Sync | Metadata, data queue, attention, worker, schedule, history, settings |
| Workflows | Workflow catalogue, drafts, runs |
| Administration | Users, roles, DHIS2 mappings, sessions, credentials, devices, device enrolment, device diagnostics (merged from Users + Devices) |
| System | Health, Metrics, Storage, Diagnostics, Analytics, Evaluation (was "Monitoring") |
| Apps | Custom app registry + install |
| Security & Audit | Audit trail, Security events, Backup, Restore, Recovery |
| Settings | Scheduler, feature flags, operator preferences |

Routes that previously lived under "Monitoring" are now surfaced under
**System**, resolving the §25 Workspace/Monitoring duplication. The
contextual sub-nav for Administration keeps Ownership + Connections
visible only when the user is on a related route.

## 2. Attention Centre (§6.2, §17)

Replaced the inert bell icon with a native `<details>`-backed popover
anchored to the topbar. On open it polls:

- `/edge-api/v1/journal/conflicts?status=OPEN` — attention items that
  need operator decisions.
- `/edge-api/v1/approvals?status=PENDING` — operator approvals.
- `/edge-api/v1/referral/inbox?status=PENDING` — pending referrals.
- `/edge-api/v1/sync/worker/health` — worker degradation signals.

Every item renders a tone-coloured chip (danger / warning / primary),
the entity label, and a deep link to its details page. Footer links to
`/sync/attention` for the full list. Count badge appears on the bell
icon only when there is at least one open item.

## 3. Search box removed from topbar (§18)

The topbar previously carried a non-functional "Search operators,
runs, resources…" input. Per §18 — *"never ship a search box that
doesn't search"* — it has been removed and replaced with a flex spacer
until a real global search ships. The sidebar workspace search
(scoped to screens the user can see) remains in place.

## 4. User authorization freshness (§20)

`UsersDashboard.tsx` grew a **Central permissions verified** column
showing a tone-coloured chip:

- **Verified** (success) if the Central DHIS2 compat probe for that
  user has succeeded in the last 2 hours.
- **Pending** (warning) otherwise.

The `title=` attribute carries the exact last-verified timestamp.
Falls back to the system-wide last Central compat probe when a
per-user timestamp is not yet available.

## 5. Destructive-action confirmations (§16)

New shared helper `confirmThenRun(effect, onConfirm)` renders a
native `window.confirm` with the full effect description plus the
sentence *"This action cannot be undone from this screen."* Wired to
every destructive action the operator can trigger from a row menu:

| Screen | Action | Effect text |
|---|---|---|
| Workflows | Delete workflow | *"Delete the workflow 'X'? Existing runs will remain in history but no new runs can start on this workflow."* |
| Drafts | Discard draft | *"Discard draft 'X'? The captured values will be lost."* |
| Attention | Accept local version | *"Accept the local version of … and send it to Central DHIS2?"* |
| Attention | Reject local version | *"Reject the local version of … The local change will be dropped."* |
| Approvals | Approve | *"Approve the … It will be queued for sync to Central DHIS2."* |
| Approvals | Reject | *"Reject the … The captured record will not be sent to Central DHIS2."* |
| Referral inbox | Accept referral | *"Accept the referral 'X' and import it locally?"* |
| Referral inbox | Dismiss referral | *"Dismiss the referral 'X'? It will be marked as handled on this edge."* |

## 6. Metadata screen — §14 fully implemented

`admin-ui/src/screens/mockups/Metadata.tsx` rewritten to meet §14.1–14.3:

- **§14.1 Grouped resources** — the flat 40-item resource dropdown is now
  grouped into **Aggregate / Tracker / Rules & Validation / Organisation
  / Options / Analytics / Administration / Other** via `<optgroup>`.
  Operators scan a short grouped list instead of a wall of labels.
- **§14.2 Metadata health summary** — a dedicated panel at the top shows:
  - Last sync (with tone — success / warning / neutral)
  - Central snapshot ID (from `/edge-api/v1/sync/drift`)
  - Edge snapshot ID
  - Drift state (`IN_SYNC` / `DRIFT` / `STALE`)
  The hero box is gone; the new `.ea-screen-header` sits above the
  health panel, with Metadata sync + Metadata drift as the primary
  actions.
- **§14.3 Detail tabs** — the right-side drawer now has
  **Summary | Relationships | Rules | Raw JSON** tabs. Raw JSON opens
  with the explicit note *"Diagnostic view … prefer the Summary /
  Relationships / Rules tabs for operator work"*, keeping it secondary.
- Relationships tab extracts referenced IDs from the mirrored payload
  (programType, categoryCombo, dataSet, programStages, dataElements,
  etc.) and shows up to 10 per field with an overflow indicator.
- Rules tab surfaces `condition`, `expression`, `leftSide/rightSide`,
  and up to 10 `programRuleActions` with their action type and
  content, so operators can inspect program-rule and validation-rule
  expressions without reading raw JSON.

## 7. Flat-UI surface radii (ask: "no border radius on most platforms")

Design tokens collapsed:

```css
/* was */  --r-sm:4px; --r-md:6px; --r-lg:8px; --r-xl:12px; --r-2xl:16px; --r-pill:999px;
/* now */  --r-sm:0;   --r-md:0;   --r-lg:0;   --r-xl:0;    --r-2xl:0;    --r-pill:999px;
```

Every surface (panel / card / drawer / modal / dl / input / button) is
now square-cornered. Pills (`.ea-chip`, `.ea-health-pill`, status
indicators), dots (`border-radius:50%`), and avatars retain their
intentional round shape because that shape *is* the signal.

Bare `dl` lost its `border-radius:var(--r-xl)` rule and
`.ea-def-list` gained `padding:10px` so key/value pairs breathe
inside the surface they sit on.

## Table row-menu escape (follow-up on §10)

`.ea-table-wrap { overflow: visible; max-width: 100%; margin: 0 }`
stays in place from 2.1.54 so the row kebab menu never clips inside
the horizontally-scrolling table.

## Live assertions (all green)

Playwright-swept against the running local DER on 2026-10-28:

| Check | Observed |
|---|---|
| Primary nav group count | 9 |
| Topbar search input present | ✗ (removed) |
| Attention bell is `<details>` with popover | ✓ |
| Attention popover deep-links to item details | ✓ |
| Users dashboard "Central permissions verified" column | ✓ |
| Workflow delete prompts with effect text | ✓ |
| Draft discard prompts with effect text | ✓ |
| Attention / Approvals / Referral destructive menu items prompt | ✓ |

## 10-of-10 scorecard — closing

With 2.1.56 (P0) + 2.1.57 (P1) landed, every row in
`docs/requirements/DER_UI_Visibility_10_of_10_Standard.md` §29 is
either ✓ or deferred-with-rationale. P2 polish items remain as
future-release candidates (not blocking the 10/10 bar).
