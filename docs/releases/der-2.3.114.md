# der-2.3.114 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.113`

## Headline

**TEI detail page surfaces when a row is captured outside the edge's
bound OU.** Previously the OU was shown as plain text with no
indication that it didn't match the edge's binding. Now the mismatch
flips the page tone to warning, drops a labelled banner explaining
the situation, chips the Org-unit field as "Out of bound OU", and
adds a Lineage drill button alongside the existing navigation.

## 1. R-AK — OU-scope awareness + layout polish

### Trigger

User-flagged on
`http://localhost:8085/admin/data/tracker/tei/RFFF095525`:

```
Org unit                             Edge binding
Albion VCA                           A&A Medcare Medical
nKz5rXN02cd                          Centre/Clinic
                                     HL2zXaIULBe
                                     /ZEzf44yY3Kd/T4LOE9sCy2R
                                      /QLtB3RDiv2c/HL2zXaIULBe
```

The TEI's `orgUnitUid` (`nKz5rXN02cd`) was not in the edge's bound
subtree path. The screen showed both without any disclosure that
the record sits outside the OU this edge is authorised to capture
under. Caused by one of:

- data captured before the current OU binding,
- a referral ingested before the current binding was set,
- or a bypass of `OrgUnitScopeInterceptor` (e.g. a direct smoke
  script that posted with an arbitrary OU UID).

### Scope-check logic

Client-side only — no server change needed:

```ts
const edgeOuPath = useOrgUnit().binding?.orgUnitPath;
const inScope = !edgeOuId
             || !edgeOuPath
             || edgeOuPath.split('/').some((seg) => seg === t.orgUnitUid);
```

The server's `EdgeOrgUnitBinding.orgUnitPath` is a `/`-joined chain
(e.g. `/root/region/district/facility`). Any OU that appears in that
path (or any descendant we'd see in future rows) counts as in-scope.
Unbound edges treat every row as in-scope.

### What the user now sees

**In-scope row** (99% case): unchanged — same tone (info), same
status label (`v<n>`), no banner.

**Out-of-scope row**:

- Status bar tone flips to **warning** (orange ink).
- Status label changes to **"Out of bound OU"** instead of the
  version number.
- Subtitle grows a line: *"Edge is bound to <edge-OU-name>"*.
- A labelled warning banner lands between the header + first panel:
  > Out-of-scope record. This TEI is captured at **Albion VCA**
  > (nKz5rXN02cd), which is outside the OU this edge is bound to
  > (**A&A Medcare Medical Centre/Clinic** · HL2zXaIULBe). Possible
  > causes: data from a previous OU binding, a referral ingested
  > before the current binding, or a bypass of the OU scope
  > interceptor. The row is still shown so operators can triage; it
  > will keep syncing to Central with its stored OU.
  > [Change edge OU binding →](/integration/organisation-unit)
- The Org-unit field in the "Tracked entity" panel renders an
  **"Out of bound OU"** chip alongside the name/UID.
- The cross-module Link to the binding screen carries
  `data-cross-module="Settings"` so the regression guard passes.

### Other polish

- New **Lineage** primary button opens the per-TEI
  `PayloadLineageDrawer` directly (previously only reachable from
  the Tracker list).
- Renamed "Workflow run (origin)" → "**Capture workflow**" (shorter,
  clearer).
- Renamed "TEI UID" → "**DHIS2 UID**" (matches the rest of the UI).
- New **Timeline** row consolidates Created / Updated / Version
  into one line with human-friendly formatting + `fmtAgo` relative
  stamp for Updated.

## 2. Live verification

```
GET /system/health                              → 200
GET /edge-api/v1/system/org-unit                → bound OU
                                                   A&A Medcare…
                                                   path /…/HL2zXaIULBe
GET /edge-api/v1/data/tracker/tei/RFFF095525    → OU nKz5rXN02cd
                                                   (Albion VCA)
→ Admin UI renders:
   - tone warning
   - "Out of bound OU" status label
   - full-width warning banner
   - "Out of bound OU" chip on Org-unit field
tsc --noEmit                                     → clean
cross-module lint                                → clean
```

## 3. Files changed

```
admin-ui/src/screens/DataTeiDetail.tsx           — + useOrgUnit import
                                                 + Lineage drawer wiring
                                                 + OU-scope detection
                                                 + "Out of bound OU"
                                                   banner + chip
                                                 + Capture workflow /
                                                   DHIS2 UID / Timeline
                                                   relabel + layout

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.114
```

## 4. Follow-ups

- The same scope check should apply to `DataEventDetail` and
  `DataAggregateDetail` — any row with `orgUnitUid` can carry the
  same warning. Not shipped here to keep R-AK scope tight.
- Server-side: `OrgUnitScopeInterceptor` only guards write paths;
  a background job that flags existing out-of-scope rows (e.g. post
  an OU-rebind) would make the issue self-healing instead of just
  visible per-row. Design: a `/admin/ops/scope/audit` endpoint that
  lists rows outside the current bound subtree.
- Smoke scripts (`scripts/smoke/tracker_e2e.sh`) hard-code
  `ORG_UNIT=nKz5rXN02cd` — in a world where the edge is bound to a
  specific OU, the script should default to the edge's bound OU or
  explicitly disclose the OU it's testing with.
