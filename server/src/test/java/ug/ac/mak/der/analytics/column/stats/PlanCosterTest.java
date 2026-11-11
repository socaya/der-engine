package ug.ac.mak.der.analytics.column.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.column.ColumnType;
import ug.ac.mak.der.analytics.column.manifest.SegmentRef;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class PlanCosterTest {

    private SegmentRef ref(final int rows) {
        return new SegmentRef(UUID.randomUUID(), "f.col",
                UUID.randomUUID(), 1, "202611", "*", "", rows);
    }

    private SegmentStatistics stats(final String column,
                                       final List<Object> sample,
                                       final boolean exhaustive,
                                       final Object min,
                                       final Object max,
                                       final int distinctEstimate) {
        final ColumnStatistics c = new ColumnStatistics(
                column, ColumnType.STRING,
                100, 0, distinctEstimate,
                exhaustive, sample, min, max);
        return new SegmentStatistics(UUID.randomUUID(),
                Instant.now(), 100, Map.of(column, c));
    }

    @Test
    void noFilterGivesFullSelectivity() {
        final PlanCoster.CostEstimate c = PlanCoster.estimate(
                ref(100), Optional.empty(),
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0));
        assertThat(c.selectivity()).isEqualTo(1.0);
        assertThat(c.estimatedRowsOut()).isEqualTo(100);
    }

    @Test
    void exhaustiveSampleHitGivesFraction() {
        // 1 hit out of 4 distinct → selectivity 0.25
        final var s = stats("orgUnit",
                List.of("OU-A", "OU-B", "OU-C", "OU-D"),
                true, "OU-A", "OU-D", 4);
        final PlanCoster.CostEstimate c = PlanCoster.estimate(
                ref(100), Optional.of(s),
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(),
                        List.of("OU-A"), Map.of(), 100, 0));
        assertThat(c.selectivity())
                .isCloseTo(0.25, offset(1e-6));
        assertThat(c.estimatedRowsOut()).isEqualTo(25);
    }

    @Test
    void exhaustiveSampleMissGivesZeroSelectivity() {
        final var s = stats("orgUnit",
                List.of("OU-A", "OU-B"),
                true, "OU-A", "OU-B", 2);
        final PlanCoster.CostEstimate c = PlanCoster.estimate(
                ref(100), Optional.of(s),
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(),
                        List.of("OU-Z"), Map.of(), 100, 0));
        assertThat(c.selectivity()).isZero();
        assertThat(c.estimatedRowsOut()).isZero();
    }

    @Test
    void multipleRequestedValuesSumUpSelectivity() {
        // 2 hits out of 4 → 0.5
        final var s = stats("orgUnit",
                List.of("OU-A", "OU-B", "OU-C", "OU-D"),
                true, "OU-A", "OU-D", 4);
        final PlanCoster.CostEstimate c = PlanCoster.estimate(
                ref(100), Optional.of(s),
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(),
                        List.of("OU-A", "OU-C"), Map.of(), 100, 0));
        assertThat(c.selectivity())
                .isCloseTo(0.5, offset(1e-6));
    }

    @Test
    void costHasFixedFloorEvenAtZeroSelectivity() {
        final var s = stats("orgUnit",
                List.of("OU-A"),
                true, "OU-A", "OU-A", 1);
        final PlanCoster.CostEstimate c = PlanCoster.estimate(
                ref(100), Optional.of(s),
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(),
                        List.of("OU-Z"), Map.of(), 100, 0));
        // Zero selectivity → cost still has FIXED_OPEN_COST +
        // bytes × epsilon.
        assertThat(c.totalCost())
                .isGreaterThanOrEqualTo(PlanCoster.FIXED_OPEN_COST);
    }

    @Test
    void largerSegmentCostsMore() {
        final PlanCoster.CostEstimate small = PlanCoster.estimate(
                ref(10), Optional.empty(),
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0));
        final PlanCoster.CostEstimate big = PlanCoster.estimate(
                ref(1000), Optional.empty(),
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0));
        assertThat(big.totalCost()).isGreaterThan(small.totalCost());
    }

    @Test
    void missingStatsAssumesFullScan() {
        final PlanCoster.CostEstimate c = PlanCoster.estimate(
                ref(50), Optional.empty(),
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(),
                        List.of("OU-A"), Map.of(), 100, 0));
        // No stats → selectivity = 1.0 (conservative).
        assertThat(c.selectivity()).isEqualTo(1.0);
        assertThat(c.estimatedRowsOut()).isEqualTo(50);
    }

    @Test
    void dimensionFilterShrinksSelectivity() {
        // 1 / distinctEstimate when a dim filter is present.
        final var s = new SegmentStatistics(UUID.randomUUID(),
                Instant.now(), 100,
                Map.of("dimensionKey", new ColumnStatistics(
                        "dimensionKey", ColumnType.STRING,
                        100, 0, 10, true, List.of(),
                        null, null)));
        final PlanCoster.CostEstimate c = PlanCoster.estimate(
                ref(100), Optional.of(s),
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(),
                        Map.of("sex", "F"), 100, 0));
        assertThat(c.selectivity()).isCloseTo(0.1, offset(1e-6));
    }
}
