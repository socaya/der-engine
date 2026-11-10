-- V113 — Ratio contributions for DHIS2-style aggregate indicators.
--
-- DHIS2 aggregate indicators compute (Numerator / Denominator) *
-- Factor (factor is typically 100 for percentages, 1000 for
-- per-1000, 100000 for per-100000 — see spec §6.1). For correct
-- math across a period / orgUnit, the materializer must sum the
-- numerator and denominator separately, then compute the ratio
-- once at the cell level — never average per-event ratios.
--
-- The ledger gets two optional NUMERIC columns alongside the
-- existing contribution_value. Non-ratio metrics leave them NULL;
-- ratio metrics populate both per event. The materializer branches
-- on whether (SUM(numerator), SUM(denominator)) are both non-null
-- + non-zero.

ALTER TABLE der.analytics_contribution
    ADD COLUMN IF NOT EXISTS numerator_contribution NUMERIC(20, 4),
    ADD COLUMN IF NOT EXISTS denominator_contribution NUMERIC(20, 4);

COMMENT ON COLUMN der.analytics_contribution.numerator_contribution IS
    'Numerator value this source contributed for a ratio metric. '
    'NULL for non-ratio metrics. Materializer sums these then '
    'divides by SUM(denominator_contribution).';

COMMENT ON COLUMN der.analytics_contribution.denominator_contribution IS
    'Denominator value this source contributed for a ratio metric. '
    'NULL for non-ratio metrics. A zero / null denominator in the '
    'aggregated cell is published as "No denominator" rather than '
    'zero (spec §6.4 Vector E).';
