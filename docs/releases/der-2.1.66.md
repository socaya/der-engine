# der-2.1.66 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.65`

## Headline

Three items from the ongoing UI polish pass:

1. **`admin-ui/src/screens/mockups/` → `admin-ui/src/screens/`.**
   The sub-directory name was a legacy artefact from Phase 03b
   when those files held mockup-aesthetic re-skins; today they
   are the real shipped screens. The `mockups/` layer is gone;
   every file moves up one level.
2. **Final stragglers of the KPI-tile strip + custom hero
   pattern cleaned up** on `/sync/drift`, `/compat`
   (legacy mockup), and `/restore`.
3. **Offline-resilience sweep** confirmed that DER remains fully
   functional with DHIS2 Tomcat stopped: every one of the 28
   navigable screens returns 200, renders a non-empty body, and
   emits no page errors.

## 1. Directory rename

### Mechanics

```
admin-ui/src/screens/mockups/*.tsx   →   admin-ui/src/screens/*.tsx
```

- 15 files moved with `git mv` so blame history is preserved.
- Internal `../../` imports (into `components/`, `api/`,
  `app/`) rewritten to `../`.
- Two files outside the folder (`CapabilityScreens.tsx`,
  `EACoreScreens.tsx`) had their `./mockups/shared` imports
  rewritten to `./shared`.
- `App.tsx`'s 12 `./screens/mockups/*` imports became
  `./screens/*`.

Component names (`MockupDashboard`, `MockupSyncOverview`, …)
are left as-is for now so the diff stays focused on the folder
layout. Those identifiers can get renamed in a later pass if the
"Mockup…" prefix also wants to go.

### Why

The `mockups/` label suggested these were throwaway scratch code
when they are the sole UI operators ever see. New contributors
reading the tree would reasonably expect `mockups/` to be
non-production — this rename removes that confusion.

## 2. Stray hero / stat-strip removals

- **`/sync/drift`** (MockupDriftInspector): custom
  `ea-dash-hero` + 6-item `ea-stat-strip` replaced with a
  `SyncStatusBar` carrying inline Added / Removed / Modified /
  Entities / Snapshot counts.
- **`/compat`** (legacy mockup inspector): `ea-dash-hero` +
  4-up KPI grid replaced with `SyncStatusBar`.
- **`/restore`**: 1-item KPI strip ("Restores on record")
  moved into the SyncStatusBar status label.

Local `Stat` helper and `IconClock` icon function removed from
`MoreScreens.tsx` — unused after the migration.

## 3. Offline resilience sweep — DHIS2 Tomcat stopped

With `brew services stop tomcat@10` (DHIS2 unreachable on 8080)
and DER running on 8085, Playwright swept the full nav tree:

| Module | Page | Status | Non-empty | Error block |
|---|---|---|---|---|
| Overview | `/` | 200 | ✓ | ✗ |
| DHIS2 | `/dhis2`, `/dhis2/compat`, `/dhis2/metadata`, `/dhis2/metadata-drift`, `/dhis2/organisation-unit` | 200 | ✓ | ✗ |
| Sync | `/sync`, `/sync/metadata`, `/sync/data`, `/sync/attention`, `/sync/worker`, `/sync/history` | 200 | ✓ | ✗ |
| Workflows | `/workflows`, `/approvals`, `/referral/inbox` | 200 | ✓ | ✗ |
| Data | `/data`, `/data/drafts` | 200 | ✓ | ✗ |
| Administration | `/provisioning/users`, `/devices` | 200 | ✓ | ✗ |
| System | `/monitoring/health`, `/monitoring/metrics`, `/monitoring/storage`, `/analytics` | 200 | ✓ | ✗ |
| Security & Audit | `/audit/verify`, `/audit/events`, `/backup`, `/restore` | 200 | ✓ | ✗ |
| Settings | `/settings` | 200 | ✓ | ✗ |

28 / 28 pages pass. DER's "offline-first" contract is intact:
operators keep working against the local mirror; queued data
sits in the journal until Central comes back; no page crashes
when the upstream probe fails.

### Known gaps surfaced by the sweep

- **Topbar runtime indicator stays on *Starting*** rather than
  switching to *Offline-first* when central is unreachable.
  Root cause: `/edge-api/v1/system/health` reports
  `status:starter-ready` indefinitely rather than transitioning
  to `UP`. Logged as a 2.2.x item — purely a label issue, not a
  functional regression.
- **`/edge-api/v1/compat`** returns the last-known-good snapshot
  (reachable:true) even after central drops; `POST
  /compat/refresh` doesn't block until the probe times out, so
  the UI's `centralReachable` check can lag by up to 15s.
  Same 2.2.x bucket.

Neither gap affects what DER can *do* while offline — only the
visual status label the operator reads.

## Build + test

```
tsc -b && vite build         ✓ 1733 modules transformed
./mvnw -q -DskipTests package  ✓ 2.1.66 JAR built
Playwright offline sweep       28/28 pages non-empty, 0 errors
Playwright post-rename smoke    6/6 target pages non-empty
```
