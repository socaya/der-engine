# der-2.3.112 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.111`

## Headline

**All queued follow-ups cleared.** The stale `acceptMarksAccepted`
test is rewritten to pin the current V045 contract (R-AH); every
disclosed cross-module Link now carries a
`data-cross-module="<target>"` attribute enforced by a new regression
guard that runs under `scripts/run_all_checks.sh` (R-AI).

## 1. R-AH — ReferralInboxController test aligned with V045

`acceptMarksAccepted` was red on `main` since the V045 "ingest
mandatory" rework (its 200 + `ingested=false` asserts hadn't been
reachable in the controller for months).

Renamed to **`acceptSurfaces502WhenIngestRejects`** and pinned to
the current contract:

- `ingest.ingest(...)` returning false → `HTTP 502 INGEST_REJECTED`.
- Inbox entry **not** marked resolved (verified via
  `Mockito.never()` on `repo.markResolved`).

The happy-path remains covered by the pre-existing
`acceptCallsIngestServiceAndReturnsIngestedFlag`. All eight
`ReferralInboxControllerTest` cases now pass.

## 2. R-AI — cross-module nav regression guard

### Convention

Every `<Link to="/<module>/..." >` that crosses a module boundary
now carries a `data-cross-module="<target>"` attribute disclosing
the target module name. The attribute is:

- **Added automatically** by `RelatedMenu` when the operator picks
  an item (`it.module` → `data-cross-module`).
- **Added inline** on bespoke affordances (workflow-run drill cells
  on Data screens, approval drill, referral drill, status chips with
  cross-module targets, header "Related" primary buttons).

### Guard

New `scripts/lint/check_cross_module.sh`:

- Walks every `.tsx` under `admin-ui/src` outside an exempt-files
  list (shared.tsx, App.tsx, AdminShell.tsx, Dashboard.tsx,
  Workspace.tsx, SystemOverview.tsx, nav & dashboard helpers).
- Heuristically determines the source module from the filename.
- Flags any `<Link to="/<module>/...">` whose target lives in a
  different module **and** doesn't carry `data-cross-module` within
  the next 6 lines.
- Exits 1 on violations with a per-line report; 0 on clean.

Wired into `scripts/run_all_checks.sh` as `admin-ui-cross-module-lint`,
running right after the admin-ui `coverage` step.

### Clean state

Baseline run after tagging ~15 pre-existing compliant Links:

```
cross-module lint: clean (0 undisclosed cross-module Links).
```

The guard also caught + flipped one stale banner in
`CapabilityScreens.tsx:1186` — "The Data page has moved" was still
pointing at `/sync/data` (pre-R-AA) instead of `/data/queue`.

## 3. Files changed

```
server/.../test/.../ReferralInboxControllerTest.java   — stale test
                                                          replaced

scripts/lint/check_cross_module.sh                     — NEW
scripts/run_all_checks.sh                              — + guard step

admin-ui/src/screens/shared.tsx                        — RelatedMenu
                                                          auto-emits
                                                          data-cross-module
admin-ui/src/screens/DataAggregate.tsx                 — tag workflow ↗
admin-ui/src/screens/DataEvents.tsx                    — tag workflow ↗
admin-ui/src/screens/DataTracker.tsx                   — tag workflow ↗
admin-ui/src/screens/DataQueues.tsx                    — tag attention
                                                          primary button
admin-ui/src/screens/MoreScreens.tsx                   — tag approval
                                                          drill, referral
                                                          drill, worker
                                                          attention link,
                                                          metadata browser,
                                                          audit + diag
                                                          links
admin-ui/src/screens/Metadata.tsx                      — tag DHIS2 Links
admin-ui/src/screens/Network.tsx                       — tag audit Links
                                                          (×3)
admin-ui/src/screens/EACoreScreens.tsx                 — tag Users /
                                                          Sync / Workflows
admin-ui/src/screens/CapabilityScreens.tsx             — tag DHIS2 /
                                                          Workflows + fix
                                                          stale /sync/data
                                                          banner
admin-ui/src/screens/UsersDashboard.tsx                — tag Users add

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.112
```

## 4. Verified

```
cd server && ./mvnw test \
       -Dtest='ReferralInboxControllerTest,
               ReferralIngestServiceTest,
               ReferralInboxRepositoryTest,
               DhisPeriodCodesTest,
               ReferralPayloadEncoderTest,
               TrackerServiceTest,
               JournalPublisherTest,
               CaptureWorkflowControllerTest'       ✓ 97/97
cd admin-ui && npx tsc --noEmit                      ✓ clean
scripts/lint/check_cross_module.sh admin-ui/src      ✓ clean
der-server-2.3.112.jar packaged + swapped            ✓ /system/health 200
```

## 5. Queue status

**Empty.** Every follow-up from R-AB → R-AI has shipped. The guard
now prevents regressions from reintroducing hidden cross-module
jumps.
