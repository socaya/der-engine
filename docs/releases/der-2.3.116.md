# der-2.3.116 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.115`

## Headline

**Scope drift becomes a first-class signal.** The scope audit from
R-AL grows a dashboard tile, a periodic Quartz job that writes
`SCOPE_DRIFT_DETECTED` to the audit stream when `total > 0`, and
the seed script learns `--clean` for idempotent reseeding. Also
fixes a sidebar active-tab bug where sub-module highlights
disappeared on deep routes.

## 1. R-AM — components

### `ScopeDriftJob` + Quartz schedule

New `scheduler/ScopeDriftJob.java` follows `JournalDrainJob`:
`@DisallowConcurrentExecution`, logged via `ScheduledJobRepository`,
runs on cron `0 */15 * * * ?` (every 15 minutes; override via
`der.scope.drift.cron`).

Each tick:
1. Calls `ScopeAuditService.audit(0)` (count-only; no samples).
2. If `total > 0` → writes a `SCOPE_DRIFT_DETECTED` security audit
   event with `boundOrgUnitId` + per-type counts in the attributes
   map. Operators can inspect the audit stream to see how long the
   drift has been sustained (oldest unresolved event = first-seen).
3. Writes `alert: SCOPE_DRIFT_DETECTED` or `alert: NONE` to the
   scheduled-job detail JSON for ops traceability.

Registered as `scopeDriftJobDetail` + `scopeDriftTrigger` beans in
`SchedulerConfig`.

### Dashboard tile

New Panel on `MockupDashboard` right-column, between **Conflict
Review** and **Edge Workflows**. Fetches `/admin/ops/scope/audit`
with `sampleLimit=0` on mount:

- **Unbound edge** → muted "bind an OU for scope checks" note.
- **Zero drift** → success dot + "All local rows match the bound
  OU subtree."
- **Drift > 0** → warning-tone total + per-entity-type list (only
  types with `n > 0` shown). Panel action: "View audit →" (labelled
  cross-module link via `data-cross-module="Security"`).

### Sidebar active-tab fix

`SectionTabs` was using `<NavLink end>` which only matches exact
URLs. Visiting `/data/tracker/tei/<uid>` left the **Tracker** tab
un-highlighted because `/data/tracker` ≠ `/data/tracker/tei/<uid>`.

Replaced with longest-prefix match: for each tab, mark active if
`pathname === it.to || pathname.startsWith(it.to + '/')`, preferring
the longer prefix on tie. Now:

- `/data/tracker` → **Tracker** active (exact)
- `/data/tracker/tei/<uid>` → **Tracker** active (prefix)
- `/data/aggregate` → **Aggregate** active (exact)
- `/data` → **Overview** active (exact, since all tabs are longer)

`aria-current="page"` is set on the active Link for assistive tech.

### Seed script `--clean`

`scripts/seeds/seed_bound_ou_data.sh` now:

- Records every successful seed in `/tmp/der-seed-log.jsonl` as a
  one-line JSON entry: `{ts, kind, uid, orgUnit}`.
- On `--clean`: reads the log, groups UIDs by kind, runs scoped
  `psql DELETE` against the five domain tables (with their child
  tables where applicable — e.g. `event_data_value` before `event`),
  then truncates the log. Aggregate seeds are deleted by their
  well-known comment prefix (`'seeded by scripts/seeds/...'`).

```
./scripts/seeds/seed_bound_ou_data.sh        # seed + log
./scripts/seeds/seed_bound_ou_data.sh --clean # purge + reset log
./scripts/seeds/seed_bound_ou_data.sh        # reseed cleanly
```

PG password defaults to the dev envelope (`der_phase01_devonly`);
override via `PG_PASS` env.

## 2. Live verification

```
GET /system/health                               → 200
Quartz Scheduler 'DerScheduler' started          ✓
GET /admin/ops/scope/audit?sampleLimit=0         → bound HL2zXaIULBe,
                                                    total 6 (stale demo
                                                    data from pre-binding)
Dashboard                                        → shows "6" + warning tone
                                                    + per-type list

./scripts/seeds/seed_bound_ou_data.sh            → 5 rows under bound OU
cat /tmp/der-seed-log.jsonl                      → 5 JSON lines
./scripts/seeds/seed_bound_ou_data.sh --clean    → all 5 purged, log
                                                   truncated

/admin/data/tracker/tei/CZn8q0B59Jm              → "Tracker" tab now
                                                   highlights (R-AM
                                                   SectionTabs fix)
```

## 3. Files changed

```
server/.../scheduler/ScopeDriftJob.java              — NEW Quartz job
server/.../scheduler/SchedulerConfig.java            — scopeDriftJob bean +
                                                       trigger (every 15 min)

admin-ui/src/api/edgeApi.ts                          — scopeAudit() helper
admin-ui/src/screens/Dashboard.tsx                   — Scope drift tile
admin-ui/src/components/SectionTabs.tsx              — longest-prefix match
                                                       for active sub-tab

scripts/seeds/seed_bound_ou_data.sh                  — --clean + record_seed
                                                       + run_clean (psql)

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.116
```

## 4. Verified

```
cd server && ./mvnw test \
       -Dtest='DhisPeriodCodesTest,
               ReferralIngestServiceTest,
               ReferralInboxControllerTest,
               CaptureWorkflowControllerTest,
               JournalPublisherTest,
               TrackerServiceTest'                   ✓ 76/76
cd admin-ui && npx tsc --noEmit                      ✓ clean
scripts/lint/check_cross_module.sh admin-ui/src      ✓ clean
der-server-2.3.116.jar packaged + swapped            ✓ /system/health 200
Quartz scheduler started                             ✓ scope-drift job
                                                       on cron
./scripts/seeds/seed_bound_ou_data.sh                ✓ 5 rows seeded +
                                                       logged
./scripts/seeds/seed_bound_ou_data.sh --clean        ✓ 5 rows purged
```

## 5. Follow-ups queued for 2.3.117 (R-AN)

- **DHIS2 Metadata UI consolidation**: `/admin/sync/metadata` and
  `/admin/dhis2/metadata-sync` are the same page under two routes.
  Keep one canonical path (`/dhis2/metadata-sync`), redirect the
  other, update nav + any lingering `/sync/metadata` links.
- **Per-type Metadata detail pages**: the Metadata browser treats
  every metadata type with a single generic table. Enhance each
  type (dataElement, program, programStage, dataSet, etc.) with a
  dedicated detail layout aligning to the DHIS2 object shape.

Both ship in 2.3.117.
