-- Phase 11 / der-1.2.0 (ADR-0020): site-level analytics facility summary.
--
-- Materialised view that counts aggregate submissions and events per
-- (org_unit, period, kind). Refreshed by AnalyticsRefreshJob on
-- der.analytics.refresh.cron (default every 5 min). Operators + admins
-- read via GET /edge-api/v1/analytics/summary.
--
-- Rejection counts live in security_audit and are queried directly
-- (not aggregated here) — the audit table already has indices.

SET search_path = der, public;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_facility_summary AS
  SELECT org_unit_uid        AS org_unit_id,
         period_iso          AS period,
         'AGGREGATE'::text   AS kind,
         COUNT(*)::bigint    AS n,
         now()               AS refreshed_at
    FROM aggregate_data_value
   GROUP BY org_unit_uid, period_iso
  UNION ALL
  SELECT org_unit_uid        AS org_unit_id,
         to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS period,
         'EVENT'::text       AS kind,
         COUNT(*)::bigint    AS n,
         now()               AS refreshed_at
    FROM event
   GROUP BY org_unit_uid, to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD');

-- REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index.
CREATE UNIQUE INDEX IF NOT EXISTS ux_analytics_facility_summary
  ON analytics_facility_summary (org_unit_id, period, kind);
