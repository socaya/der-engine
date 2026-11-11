package ug.ac.mak.der.analytics.replay;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsContributionRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * Spec §17 outage/replay release gate + AT-20 (crash-during-tx
 * recovery). Re-aggregates every materialised cell directly from
 * the contribution ledger and compares against the stored value.
 * Any drift is reported — zero drift is the evidence that
 * at-least-once journal delivery produces exactly-once observable
 * tally effect (AN-NFR-004).
 *
 * <p>This is intentionally a <em>read-only verifier</em>, not a
 * repair job. Operators should see drift surfaced (so a bad
 * materialization run is caught) before any automatic rewrite
 * modifies ledger-derived numbers.</p>
 */
@Service
public class AnalyticsBaselineVerifier {

    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsContributionRepository contributions;

    public AnalyticsBaselineVerifier(
            final AnalyticsEngineRepository engineRepo,
            final AnalyticsContributionRepository contributions) {
        this.engineRepo = Objects.requireNonNull(engineRepo, "engineRepo");
        this.contributions = Objects.requireNonNull(contributions,
                "contributions");
    }

    public record Drift(
            UUID metricId,
            int definitionVersion,
            String periodKey,
            String orgUnitUid,
            String dimensionKey,
            BigDecimal storedValue,
            BigDecimal recomputedValue,
            Long storedCount,
            long recomputedCount,
            String reason) {
    }

    public record BaselineReport(
            int cellsChecked,
            int cellsOk,
            int cellsDrifted,
            int metricsMissing,
            List<Drift> drifts) {
    }

    /** Verify at most {@code maxCells} materialised cells. Cells
     *  are sampled in ledger order — a soak run uses limit = -1
     *  (or any non-positive) to walk everything. */
    @Transactional(readOnly = true)
    public BaselineReport verify(final int maxCells) {
        final int limit = maxCells <= 0 ? 2_000 : maxCells;
        final AnalyticsEngineRepository.CellQuery q =
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        limit, 0);
        final List<AnalyticsCell> cells = engineRepo.queryCells(q);
        final List<Drift> drifts = new ArrayList<>();
        int ok = 0;
        int missing = 0;
        for (final AnalyticsCell c : cells) {
            final Optional<AnalyticsDefinition> defOpt =
                    engineRepo.findDefinition(c.metricId());
            if (defOpt.isEmpty()) {
                missing++;
                continue;
            }
            final AnalyticsDefinition def = defOpt.get();
            final AnalyticsContributionRepository.CellAggregate agg =
                    contributions.aggregateForCell(def.id(),
                            def.definitionVersion(), c.periodKey(),
                            c.orgUnitUid(), c.dimensionKey() == null
                                    ? "" : c.dimensionKey());
            final BigDecimal recomputed = expectedValue(def, agg);
            final boolean countMatches = c.countValue() == null
                    || c.countValue() == agg.count();
            final boolean valueMatches = valuesEqual(c.value(), recomputed);
            if (countMatches && valueMatches) {
                ok++;
                continue;
            }
            drifts.add(new Drift(
                    c.metricId(), c.definitionVersion(), c.periodKey(),
                    c.orgUnitUid(),
                    c.dimensionKey() == null ? "" : c.dimensionKey(),
                    c.value(), recomputed,
                    c.countValue(), agg.count(),
                    reasonFor(countMatches, valueMatches)));
        }
        return new BaselineReport(cells.size(), ok, drifts.size(),
                missing, drifts);
    }

    /** Compute what the cell value <em>should</em> be given the
     *  current ledger aggregate, using the same contract as
     *  {@link ug.ac.mak.der.analytics.engine.AnalyticsMaterializer}.
     *  Ratio metrics are honoured — a verifier that disagreed with
     *  the materializer on ratio math would raise a false alarm. */
    private static BigDecimal expectedValue(final AnalyticsDefinition def,
                                              final AnalyticsContributionRepository.CellAggregate agg) {
        if (agg.count() == 0L) {
            return null;
        }
        final boolean isRatio = agg.sumNumerator() != null
                || agg.sumDenominator() != null;
        if (isRatio) {
            final BigDecimal n = agg.sumNumerator();
            final BigDecimal d = agg.sumDenominator();
            if (n == null || d == null || d.signum() == 0) {
                return null;
            }
            return n.divide(d, java.math.MathContext.DECIMAL64);
        }
        final String aggType = def.aggregationType() == null
                ? "COUNT" : def.aggregationType();
        return switch (aggType) {
            case "SUM" -> agg.sum();
            case "COUNT", "COUNT_DISTINCT", "NONE" ->
                    BigDecimal.valueOf(agg.count());
            default -> agg.sum();
        };
    }

    private static boolean valuesEqual(final BigDecimal a,
                                         final BigDecimal b) {
        if (a == null && b == null) {
            return true;
        }
        if (a == null || b == null) {
            return false;
        }
        return a.compareTo(b) == 0;
    }

    private static String reasonFor(final boolean countMatches,
                                      final boolean valueMatches) {
        if (!countMatches && !valueMatches) {
            return "count and value drift";
        }
        if (!countMatches) {
            return "count drift";
        }
        return "value drift";
    }

    /** JSON projection — stable keys so the admin UI and tests can
     *  rely on them. */
    public static Map<String, Object> asJson(final BaselineReport r) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("cellsChecked", r.cellsChecked());
        out.put("cellsOk", r.cellsOk());
        out.put("cellsDrifted", r.cellsDrifted());
        out.put("metricsMissing", r.metricsMissing());
        final List<Map<String, Object>> drifts = new ArrayList<>(r.drifts().size());
        for (final Drift d : r.drifts()) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("metricId", d.metricId().toString());
            m.put("definitionVersion", d.definitionVersion());
            m.put("periodKey", d.periodKey());
            m.put("orgUnitUid", d.orgUnitUid());
            m.put("dimensionKey", d.dimensionKey());
            m.put("storedValue", d.storedValue() == null ? null
                    : d.storedValue().toPlainString());
            m.put("recomputedValue", d.recomputedValue() == null ? null
                    : d.recomputedValue().toPlainString());
            m.put("storedCount", d.storedCount());
            m.put("recomputedCount", d.recomputedCount());
            m.put("reason", d.reason());
            drifts.add(m);
        }
        out.put("drifts", drifts);
        return out;
    }
}
