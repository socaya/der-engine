# der-2.1.13 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.12`

## Headline

Fix two stale health-check assumptions on the Workspace
landing. "DER status" no longer renders as `starter-ready` in
red, and the "Local database" tile no longer sits as "Degraded"
when the DB is clearly live. Both propagate up so the hero chip
reads "All systems operational" instead of a false "Partial
outage".

## Root causes

### `starter-ready` was treated as not-up

The admin UI compared `h.status === 'UP'` in several places,
but the server's `/edge-api/v1/system/health` reports
`"starter-ready"` (documented on `SystemHealthResponse`).
Every KPI, hero chip and health-list row that used this
comparison flipped to the failure branch, rendering the raw
string in a red chip.

### Database check referenced fields that don't exist

The Workspace tile used `si.database.configured &&
!si.database.probeError`. `/system/info` only returns `product`,
`flywayVersion`, `migrationCount`, `userCount`, `sessionCount`.
Both `configured` and `probeError` resolved to `undefined`, so
the check always failed closed and labelled a healthy DB as
`Degraded`.

## Changes

### Shared helper `isDerUp(status)`

New small helper (copied inline in each file that needed it so
there's no new shared import graph): returns `true` for `UP`,
`starter-ready`, or `ready`.

### `admin-ui/src/screens/mockups/Workspace.tsx`
- `derUp = isDerUp(h.status)` precomputed; `derStatusLabel`
  reads `"Live"` when up, falls back to the raw status
  otherwise.
- Hero chip tone and copy switch on `derUp` + `allOps`.
- "DER status" KPI uses `derUp` for both tone and value.
- Topology middle node uses `derUp`.
- **Database check rewritten** to
  `Boolean(si.database.product) && (si.database.migrationCount ?? 0) > 0`
  so a live Postgres with migrations applied reports as
  `Operational` instead of `Degraded`.

### `admin-ui/src/screens/mockups/Dashboard.tsx`
- Added inline `isDerUp` helper.
- Hero chip replaces `h.status === 'UP'` with `isDerUp(h.status)`.

### `admin-ui/src/screens/mockups/SystemOverview.tsx`
- Added inline `isDerUp` helper.
- `allOps` precomputes `derUp && c?.probeReachable`.
- "Status" KPI uses `derUp` for tone + label.

### `admin-ui/src/screens/CapabilityScreens.tsx`
- Added file-scope `isDerUp` helper near the other formatting
  helpers.
- Component matrix row for "DER service" uses `isDerUp(h.status)`.
- "DER service running" checklist item uses `isDerUp(h.status)`.

## Live verification

| Tile / chip                 | Value                      | Tone                 |
|-----------------------------|----------------------------|----------------------|
| DER status KPI              | **Live**                   | success              |
| DHIS2 KPI                   | Connected                  | success              |
| Local database KPI          | **Operational**            | success              |
| Synchronisation KPI         | Running                    | success              |
| Client devices KPI          | 0                          | info                 |
| Workspace hero chip         | **All systems operational**| success              |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.13/V2113-workspace.png`.
