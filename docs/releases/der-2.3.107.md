# der-2.3.107 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.106`

## Headline

**No more hidden cross-module jumps.** Every primary action that
used to silently teleport an operator from one module into another
is now either removed, labelled with the target-module name, or
disclosed behind a dedicated **Related** dropdown. Category-A
findings from the 2.3.106 audit all cleared.

## 1. R-AB — Category A cross-module cleanup

**The rule** (`CLAUDE.md`-grade):

> Modules may not expose unlabelled jumps into other modules.
> Cross-module navigation must be either (a) a labelled "Related"
> dropdown in a screen header, (b) a labelled per-row context menu,
> or (c) a landing-page "View All" tile. Every other crossing is a
> gap.

### New shared primitive

`shared.tsx` grows `RelatedMenu` + `RelatedMenuItem` — a labelled
`<details>` dropdown with "Related ▾" summary. Each item carries an
optional `module` prefix (e.g. `"Sync › Settings"`) so the operator
sees which module the item lives in before clicking. Matches the
styling of the existing `RowMenu` for visual consistency.

### Five fixes shipped

| # | File:line | Before | After |
|---|---|---|---|
| 1 | `Network.tsx:174` (Central-DHIS2 facet card) | Entire card clickable → `/sync/settings`. Hidden cross-module jump. | Status-only card (`to` removed). `NetFacetCard` prop is now optional; the card renders as a static tile when omitted. |
| 1b | `Network.tsx:135` (header actions) | — | New `<RelatedMenu>`: *Sync › Sync worker settings · Security › Network audit events*. The sync-config jump has a disclosed home. |
| 2 | `MoreScreens.tsx:144-158` (Metadata screen footer) | Three loose Links — Metadata browser, Metadata sync, Sync history — no module distinction. | Metadata browser stays as intra-module button; the two Sync jumps collapse into a `<RelatedMenu>`: *Sync › Metadata sync · Sync › Sync history*. |
| 3 | `CapabilityScreens.tsx:1318-1331` (DHIS2 Compat screen → Sync behaviour panel) | Three primary buttons jumping to `/sync/schedule`, `/settings`, `/sync/history`. | One `<RelatedMenu>`: *Sync › Open schedule · Sync › Sync history · Settings › Fine-grained settings*. |
| 4 | `SyncHistory.tsx:279` (operation detail header) | Loose "Workflow monitoring" button → `/workflows/monitoring`. Soft exit with no context. | `<RelatedMenu>` on the same spot: *Workflows › Workflow monitoring*. |
| 5 | `EACoreScreens.tsx:772` (Scheduler header) | "Trigger a job" link to `/sync/jobs/trigger`. No disclosure that it leaves the current module. | Label changed to **"Sync › Trigger a job"** so the module boundary is explicit. |

### Component additions

- `shared.tsx` → `RelatedMenu`, `RelatedMenuItem` (public exports;
  reused by Network, MoreScreens, CapabilityScreens, SyncHistory in
  this release).
- `Network.tsx` → `NetFacetCard.to` is now optional. When omitted
  the card is a static status tile (new `.ea-net-facet--static`
  modifier for consumer-side styling).

## 2. Live verification

```
GET /system/health                                 → 200
GET /admin/network         (shell + Related menu)  → 200
GET /admin/sync/history/:runId                     → 200
tsc --noEmit                                        → clean
admin-ui bundle                                     → 2.3.107 ok
```

## 3. Files changed

```
admin-ui/src/screens/shared.tsx                     — + RelatedMenu
admin-ui/src/screens/Network.tsx                    — status-only facet
                                                      + header Related menu
                                                      + NetFacetCard.to opt
admin-ui/src/screens/MoreScreens.tsx                — Metadata Related menu
admin-ui/src/screens/CapabilityScreens.tsx          — DHIS2 Compat Related
admin-ui/src/screens/SyncHistory.tsx                — Workflows Related
admin-ui/src/screens/EACoreScreens.tsx              — "Sync › Trigger" label

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.107
```

## 4. Audit status after R-AB

- **Category A** (hidden violations) — ✅ **cleared**.
- **Category B** (Data chip jumps to `/sync/attention`) — ✅ already
  labelled via `<Status to="...">` and only reachable by clicking
  the chip; no change needed.
- **Category C** (Data → Workflows run drill via `ScopedFilterChip`)
  — ✅ already explicit ("Open run" button); no change.
- **Category D** (Dashboard/Workspace "View All" tiles) — ✅ by
  design; keep.

**~85 cross-module links audited; 5 reshaped. The rule is now
enforceable going forward.**

## 5. Follow-ups

- Extract a `data-cross-module="<target-module>"` attribute convention
  so future lint rules can flag hidden jumps automatically.
- Pattern wrap for `<Status to="/sync/attention/...">` chips so the
  screen reader announces "navigates to Sync module" — accessibility
  refinement, defer until operators ask.
- Review the `/approvals/*`, `/referral/*`, and `/dhis2/metadata`
  module boundaries (they were Category B/D on this pass; worth
  re-checking once R-AB settles).
