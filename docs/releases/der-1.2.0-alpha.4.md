# DER 1.2.0-alpha.4 — Initiative 7 slice A: site-level analytics

> **Scope:** First slice of ADR-0020. DER now has a facility-level
> analytics materialised view, a Quartz-driven 5-minute refresh job,
> and a read-only admin screen summarising aggregate submissions,
> captured events, and recent rejections. Charts, program-level
> breakdowns, and user-pivoted analytics are deliberately deferred
> to slice B.

**Release label:** `der-1.2.0-alpha.4`
**Git tag:** `der-1.2.0-alpha.4`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- Database migration **V016** — `analytics_facility_summary`
  materialised view (`org_unit`, `period`, `kind` → `n`,
  `refreshed_at`), unique index for `REFRESH … CONCURRENTLY`.
- `ug.ac.mak.der.analytics` package:
    - `FacilitySummaryRow` — record with `(orgUnitId, period, kind, n,
      refreshedAt)`; rejects `n < 0`.
    - `AnalyticsRepository` — `@ConditionalOnBean(JdbcTemplate.class)`.
      `summary(orgUnit, kind)` with dynamic filtering,
      `recentRejections(limit)` capped at 5 000,
      `lastRefreshedAt()` scalar, `refresh()` wraps
      `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
    - `AnalyticsService` — thin delegate; `refreshNow()` logs failures
      and re-throws so the controller can map them to a 500.
- `ug.ac.mak.der.scheduler.AnalyticsRefreshJob` — Quartz job with
  `@DisallowConcurrentExecution`; writes outcome rows into
  `scheduled_job_run`. Cron is configurable via
  `der.analytics.refresh.cron` (default `0 */5 * * * ?`).
- `AnalyticsController` at `/edge-api/v1/analytics/**`:
    - `GET /summary?orgUnit=&kind=` → `{ rows, lastRefreshedAt }` —
      any authenticated user.
    - `GET /rejections?limit=` → `{ count }` — any authenticated user.
    - `POST /refresh` — **ADMIN only**; 500 with
      `code=ANALYTICS_REFRESH_FAILED` on JDBC failure.
- Admin UI `EAFacilityAnalytics` (EA-ANA-01) at `/analytics`:
    - 3 cards (aggregate total, event total, recent rejections).
    - Last-refreshed timestamp + "Refresh now" button.
    - Full breakdown table (OU / period / kind / n).
    - Error, loading, empty states fully covered.
- 3 new `edgeApi` helpers: `analyticsSummary`, `analyticsRejections`,
  `analyticsRefresh`.
- 24 new server tests (row record + repository + service +
  controller including role gating and 500 mapping).
- 6 new admin-ui screen tests + 1 Playwright spec + 4 edgeApi table
  rows.

## Behaviour

```
Quartz fires every 5 min (configurable):
  AnalyticsRefreshJob
    ↳ AnalyticsService.refreshNow()
       ↳ REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_facility_summary
    ↳ scheduled_job_run insert (OK | ERROR + payload)

GET /edge-api/v1/analytics/summary?orgUnit=ou1&kind=event
  ↳ reads matview with optional filters
  ↳ returns { rows, lastRefreshedAt }   (any-auth)

POST /edge-api/v1/analytics/refresh      (ADMIN only)
  ↳ forces an immediate refresh out-of-band
```

Rejection counts come from `security_audit` directly (no new table);
the existing audit indices keep the lookup bounded.

## Test state

- **1098 server tests** pass (was 1074 + 24 new). `mvn verify` green.
- Admin-ui: **201 tests** pass (was 195 + 6 new). Vitest at
  **100 / 90.71 / 97.64 / 100**. Thresholds unchanged.
- Client: unchanged — no DC-side work in this alpha.
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred to slice B / ADR-0020 part 2)

- Charts of any kind (line, bar, heatmap). Slice A ships numbers.
- Program-level breakdowns (DER-level program-wise rollups).
- User-pivoted analytics ("who captured the most this week").
- Multi-facility aggregation (DER-aggregator deployments).
- Export (CSV / Excel) — slice B.
- Scheduled email / nightly summary.

## Promotion path

`der-1.2.0-alpha.4` → `der-1.2.0-alpha.5` (Initiative 8 part 2:
hash-chain audit, GPG-wrapped S3 backups) → stable `der-1.2.0`.
