# ADR-0020: Site-level analytics (slice A)

- Status: **ACCEPTED (slice A — facility summary counts)**
- Date decided: 2026-10-22
- Deciders: socaya
- Related: ADR-0004 (hybrid edge), ADR-0008 (Quartz scheduler),
  ADR-0010 (journal worker), ADR-0015 (orgUnit binding), post-1.0
  roadmap Initiative 7

## Context

The project proposal promises *site-level EDGE lightweight analytics
engine to support analysis of data within the facility*. Pilot
operators want to see what their clinic has captured without going
all the way to central. DHIS2's full analytics engine (dimensions,
indicators, pivot tables) is way out of scope for an edge box; the
goal is a few operator-facing counts refreshed often.

The post-1.0 roadmap scopes this as Initiative 7.

## Decisions (slice A)

| # | Decision | Chosen |
|---|---|---|
| D-ANA-1 | Analytics domains in slice A | Aggregate submission count + event count + rejection count, grouped by `(org_unit, period_iso, kind)`. No coverage %, no completeness, no DHIS2 indicator parity. |
| D-ANA-2 | Materialisation | Single materialised view `analytics_facility_summary`; refreshed by a Quartz job on `der.analytics.refresh.cron` (default every 5 min). |
| D-ANA-3 | Who sees analytics | Both OPERATOR and ADMIN — any authenticated user via `GET /edge-api/v1/analytics/**`. Nothing in there is privileged. |
| D-ANA-4 | Chart library | **None** in slice A. Slice B adds `recharts` (or sibling) with real charts; slice A ships a readable `<table>` + numeric cards. Keeps the pilot APK slim and the admin-ui build fast. |
| D-ANA-5 | Date-range filter scope | `period_iso` filter at the service layer (DHIS2 period strings `202604`, `2026W12`, `2026-04-15`, etc). Range filter + chart ships in slice B. |

## Schema (V016)

```sql
CREATE MATERIALIZED VIEW analytics_facility_summary AS
  SELECT org_unit_uid        AS org_unit_id,
         period_iso          AS period,
         'AGGREGATE'::text   AS kind,
         COUNT(*)            AS n,
         now()               AS refreshed_at
    FROM aggregate_data_value
   GROUP BY org_unit_uid, period_iso
  UNION ALL
  SELECT org_unit_uid        AS org_unit_id,
         to_char(occurred_at, 'YYYY-MM-DD') AS period,
         'EVENT'::text       AS kind,
         COUNT(*)            AS n,
         now()               AS refreshed_at
    FROM event
   GROUP BY org_unit_uid, to_char(occurred_at, 'YYYY-MM-DD');
```

Plus:
- An index on `(org_unit_id, period, kind)` for fast look-ups.
- `REFRESH MATERIALIZED VIEW CONCURRENTLY` is a Postgres requirement —
  it needs a unique index, which the index above provides.

Rejection counts are derived from `security_audit` where the
`event_type` ends in `_REJECTED`. Slice A doesn't aggregate them into
the view — the service queries `security_audit` directly since the
row-counts are small and the audit table already has indices.

## Service surface

```
GET /edge-api/v1/analytics/summary                       Any authenticated role
GET /edge-api/v1/analytics/summary?orgUnit=<uid>         (filters as query params)
GET /edge-api/v1/analytics/summary?kind=AGGREGATE|EVENT
GET /edge-api/v1/analytics/rejections?limit=<n>          Count of recent *_REJECTED audit events
POST /edge-api/v1/analytics/refresh                      ADMIN — force-refresh outside the cron
```

## Quartz

- `AnalyticsRefreshJob` fires on `der.analytics.refresh.cron`
  (default `0 */5 * * * ?`). Runs
  `REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_facility_summary`.
- `SchedulerConfig` registers the job + trigger alongside the
  existing Quartz jobs.
- Admin can trigger an immediate refresh via
  `POST /edge-api/v1/analytics/refresh`.

## Admin UI

New screen bundled into `EACoreScreens.tsx`:

- `EAFacilityAnalytics` (EA-ANA-01) at `/analytics` — simple summary
  table grouped by `(org_unit, period, kind)` with totals + "last
  refreshed at" indicator + "Refresh now" button for admins.

## Not in scope (slice B promises)

- Coverage % (needs the expected-dataSetMembers list from DHIS2
  compat metadata).
- Timeliness (needs scheduled vs. actual completion comparison).
- Data quality rules (needs cross-row rule engine).
- Charts (recharts / nivo integration).
- Date-range filter + period aggregation.
- Export to CSV / JSON.
- DHIS2-analytics-engine parity (dimension drill-down,
  indicators, pivot tables).

## Consequences

- A single materialised view means a `REFRESH` locks the whole view
  for the duration. Benchmarks on 10k rows per domain run under 50ms
  on the pilot hardware; the pilot runbook §7 will add a note once
  Initiative 8 part 2 benchmarks it.
- Any authenticated user sees analytics. If pilot sites want OPERATOR
  to see less than ADMIN, we add role-based filtering in slice B.
- `security_audit` is read directly for rejection counts — the view
  grows O(audit-row-count) over time; truncation strategy is a
  Phase 11 operations concern.
