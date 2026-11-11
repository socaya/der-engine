package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Rebuilds {@link AnalyticsCell} rows from the contribution ledger.
 *
 * <p>Spec §7.4 "incremental algorithm" — after a source change has
 * been upserted into the contribution ledger (or retracted), call
 * {@link #materializeCell} to aggregate the eligible, committed
 * contributions for one cell and persist the result. Callers are
 * expected to collect the set of affected cell keys first (via
 * {@link AnalyticsContributionRepository#cellsForSource}) and loop.</p>
 *
 * <p>Aggregation semantics for Phase 2:</p>
 * <ul>
 *   <li>{@code COUNT} / default — persist count = COUNT(*),
 *       value = count.</li>
 *   <li>{@code SUM} — persist sum = SUM(contribution_value),
 *       value = sum, countValue also populated for the "contributions"
 *       drill-down (so operators see how many records drove the sum).</li>
 *   <li>Non-invertible aggregations (AVERAGE, STDDEV, MIN, MAX,
 *       COUNT_DISTINCT) land in Phase 3+; they need either a
 *       different materialisation strategy or a full-recompute on
 *       retract. Phase 2 falls back to persisting count + sum for
 *       them and tags the cell with {@code quality_state =
 *       PROVISIONAL} so operators see it's pending verification.</li>
 * </ul>
 *
 * <p>When the aggregate count is zero the cell is deleted — leaving
 * a visible zero would be a stale materialisation artifact after all
 * contributions have been retracted.</p>
 */
@Service
public class AnalyticsMaterializer {

    private final AnalyticsEngineRepository cells;
    private final AnalyticsContributionRepository contributions;

    public AnalyticsMaterializer(final AnalyticsEngineRepository cells,
                                   final AnalyticsContributionRepository contributions) {
        this.cells = Objects.requireNonNull(cells, "cells");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
    }

    /** Rebuild one cell from its contributions. Safe to call repeatedly
     *  — the final row is the authoritative aggregate regardless of
     *  prior state. Returns the persisted value or null if the cell
     *  was deleted (no contributions). */
    @Transactional
    public BigDecimal materializeCell(final AnalyticsDefinition def,
                                        final String periodKey,
                                        final String orgUnitUid,
                                        final String dimensionKey) {
        return materializeCell(def, periodKey, orgUnitUid, dimensionKey,
                BigDecimal.ONE);
    }

    /** Full form — {@code factor} is the DHIS2 aggregate-indicator
     *  factor (typically 1 / 100 / 1000 / 100000). Ratio metrics
     *  compute {@code (SUM(num) / SUM(den)) * factor}. Non-ratio
     *  metrics ignore the factor. */
    @Transactional
    public BigDecimal materializeCell(final AnalyticsDefinition def,
                                        final String periodKey,
                                        final String orgUnitUid,
                                        final String dimensionKey,
                                        final BigDecimal factor) {
        Objects.requireNonNull(def, "def");
        final AnalyticsContributionRepository.CellAggregate agg =
                contributions.aggregateForCell(def.id(),
                        def.definitionVersion(), periodKey, orgUnitUid,
                        dimensionKey);
        if (agg.count() == 0L) {
            cells.deleteCell(def.id(), def.definitionVersion(),
                    periodKey, orgUnitUid,
                    dimensionKey == null ? "" : dimensionKey);
            return null;
        }
        final String aggType = def.aggregationType() == null
                ? "COUNT" : def.aggregationType();
        final boolean isRatio = agg.sumNumerator() != null
                || agg.sumDenominator() != null;

        BigDecimal value;
        BigDecimal numerator = null;
        BigDecimal denominator = null;
        String qualityState;
        if (isRatio) {
            numerator = agg.sumNumerator();
            denominator = agg.sumDenominator();
            // Vector E — a zero / null denominator is an undefined
            // ratio, not zero. Emit PROVISIONAL with null value so
            // the UI renders "No denominator".
            if (denominator == null || denominator.signum() == 0
                    || numerator == null) {
                value = null;
                qualityState = "PROVISIONAL";
            } else {
                final BigDecimal f = factor == null ? BigDecimal.ONE : factor;
                value = numerator
                        .multiply(f)
                        .divide(denominator, java.math.MathContext.DECIMAL64);
                qualityState = "VERIFIED";
            }
        } else {
            value = switch (aggType) {
                case "SUM" -> agg.sum();
                case "COUNT", "COUNT_DISTINCT", "NONE" ->
                        BigDecimal.valueOf(agg.count());
                case "MIN" -> agg.min();
                case "MAX" -> agg.max();
                case "AVERAGE" ->
                        // Multiset-aware: recompute from the current
                        // ledger each pass so a deletion that drops
                        // the former average participant doesn't
                        // leave the cell holding a stale divisor
                        // (SRS FR-INC-003).
                        agg.sum() == null || agg.count() == 0L
                                ? null
                                : agg.sum().divide(
                                        java.math.BigDecimal.valueOf(
                                                agg.count()),
                                        java.math.MathContext.DECIMAL64);
                default -> agg.sum(); // STDDEV / VARIANCE — Gate 4
            };
            qualityState = switch (aggType) {
                case "COUNT", "SUM", "NONE", "MIN", "MAX", "AVERAGE" ->
                        "VERIFIED";
                default -> "PROVISIONAL";
            };
        }
        final AnalyticsCell c = new AnalyticsCell(
                def.id(), def.definitionVersion(),
                periodKey, orgUnitUid,
                dimensionKey == null ? "" : dimensionKey,
                agg.count(),
                agg.sum(),
                value,
                numerator,
                denominator,
                Instant.now(),
                qualityState);
        cells.upsertCell(c);
        return value;
    }

    /** Apply a single-source change: upsert the contribution, then
     *  materialise every cell the source has touched (including the
     *  cells it just left behind so a period change retracts the
     *  prior cell).
     *
     *  Ignores a change whose source_version is older than what's
     *  already in the ledger — defensive against out-of-order journal
     *  delivery. */
    @Transactional
    public void applyContribution(final AnalyticsDefinition def,
                                    final AnalyticsContribution next) {
        applyContribution(def, next, BigDecimal.ONE);
    }

    /** Full-form apply — pass the aggregate-indicator factor so ratio
     *  metrics compute {@code (SUM(num) / SUM(den)) * factor}. */
    @Transactional
    public void applyContribution(final AnalyticsDefinition def,
                                    final AnalyticsContribution next,
                                    final BigDecimal factor) {
        Objects.requireNonNull(def, "def");
        Objects.requireNonNull(next, "next");
        final var prior = contributions.cellsForSource(def.id(),
                def.definitionVersion(), next.sourceKey());
        contributions.upsert(next);
        final var dim = next.dimensionKey() == null ? "" : next.dimensionKey();
        final boolean overlaps = prior.stream().anyMatch(r ->
                r.periodKey().equals(next.periodKey())
             && r.orgUnitUid().equals(next.orgUnitUid())
             && java.util.Objects.equals(r.dimensionKey(), dim));
        for (final var ref : prior) {
            materializeCell(def, ref.periodKey(), ref.orgUnitUid(),
                    ref.dimensionKey(), factor);
        }
        if (!overlaps) {
            materializeCell(def, next.periodKey(), next.orgUnitUid(), dim,
                    factor);
        }
    }

    /** Retract every contribution for a source (soft-delete / cancel)
     *  and rebuild the affected cells. */
    @Transactional
    public void retractSource(final AnalyticsDefinition def,
                                final UUID metricId,
                                final int definitionVersion,
                                final String sourceKey) {
        final var prior = contributions.cellsForSource(metricId,
                definitionVersion, sourceKey);
        contributions.removeForSource(metricId, definitionVersion, sourceKey);
        for (final var ref : prior) {
            materializeCell(def, ref.periodKey(), ref.orgUnitUid(),
                    ref.dimensionKey());
        }
    }
}
