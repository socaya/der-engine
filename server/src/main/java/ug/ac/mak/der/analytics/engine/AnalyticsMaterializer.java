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
        final BigDecimal value = switch (aggType) {
            case "SUM" -> agg.sum();
            case "COUNT", "COUNT_DISTINCT", "NONE" ->
                    BigDecimal.valueOf(agg.count());
            default -> agg.sum(); // AVERAGE/STDDEV/etc. — see JDoc note
        };
        final String qualityState = switch (aggType) {
            case "COUNT", "SUM", "NONE" -> "VERIFIED";
            default -> "PROVISIONAL";
        };
        final AnalyticsCell c = new AnalyticsCell(
                def.id(), def.definitionVersion(),
                periodKey, orgUnitUid,
                dimensionKey == null ? "" : dimensionKey,
                agg.count(),
                agg.sum(),
                value,
                null,  // numerator — Phase 3+ ratio metrics
                null,  // denominator — Phase 3+ ratio metrics
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
        Objects.requireNonNull(def, "def");
        Objects.requireNonNull(next, "next");
        // Capture the cells the source currently touches so we can
        // materialise them again after the upsert (the source may have
        // moved to a new period / orgUnit).
        final var prior = contributions.cellsForSource(def.id(),
                def.definitionVersion(), next.sourceKey());
        contributions.upsert(next);
        // Set of distinct cells to materialise: prior + the new one.
        final var dim = next.dimensionKey() == null ? "" : next.dimensionKey();
        final boolean overlaps = prior.stream().anyMatch(r ->
                r.periodKey().equals(next.periodKey())
             && r.orgUnitUid().equals(next.orgUnitUid())
             && java.util.Objects.equals(r.dimensionKey(), dim));
        for (final var ref : prior) {
            materializeCell(def, ref.periodKey(), ref.orgUnitUid(),
                    ref.dimensionKey());
        }
        if (!overlaps) {
            materializeCell(def, next.periodKey(), next.orgUnitUid(), dim);
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
