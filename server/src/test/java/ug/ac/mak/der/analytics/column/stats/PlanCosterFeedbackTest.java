package ug.ac.mak.der.analytics.column.stats;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.column.ColumnType;
import ug.ac.mak.der.analytics.column.manifest.SegmentRef;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class PlanCosterFeedbackTest {

    private SegmentRef ref(final int rows) {
        return new SegmentRef(UUID.randomUUID(), "f.col",
                UUID.randomUUID(), 1, "202611", "*", "", rows);
    }

    private SegmentStatistics stats(final int distinctEstimate) {
        final ColumnStatistics c = new ColumnStatistics(
                "orgUnit", ColumnType.STRING,
                100, 0, distinctEstimate, true,
                List.of("OU-A", "OU-B", "OU-C", "OU-D"),
                "OU-A", "OU-D");
        return new SegmentStatistics(UUID.randomUUID(),
                Instant.now(), 100, Map.of("orgUnit", c));
    }

    private AnalyticsEngineRepository.CellQuery query() {
        return new AnalyticsEngineRepository.CellQuery(
                List.of(), List.of(),
                List.of("OU-A"), Map.of(),
                100, 0);
    }

    @Test
    void nullRatioMatchesBaseEstimate() {
        final var base = PlanCoster.estimate(ref(100),
                Optional.of(stats(4)), query());
        final var withNull = PlanCoster.estimate(ref(100),
                Optional.of(stats(4)), query(), null);
        assertThat(withNull.selectivity())
                .isEqualTo(base.selectivity());
        assertThat(withNull.totalCost())
                .isEqualTo(base.totalCost());
    }

    @Test
    void observedRatioScalesSelectivityUp() {
        // base selectivity 1/4 = 0.25; observed ratio 2.0 → 0.5
        final var adjusted = PlanCoster.estimate(ref(100),
                Optional.of(stats(4)), query(), 2.0);
        assertThat(adjusted.selectivity())
                .isCloseTo(0.5,
                        org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void observedRatioScalesSelectivityDown() {
        // base 0.25 × 0.4 = 0.1
        final var adjusted = PlanCoster.estimate(ref(100),
                Optional.of(stats(4)), query(), 0.4);
        assertThat(adjusted.selectivity())
                .isCloseTo(0.1,
                        org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void selectivityClampsAtOne() {
        // base 0.25 × 10.0 = 2.5, must clamp at 1.0
        final var adjusted = PlanCoster.estimate(ref(100),
                Optional.of(stats(4)), query(), 10.0);
        assertThat(adjusted.selectivity()).isEqualTo(1.0);
    }

    @Test
    void zeroOrNegativeRatioIgnored() {
        final var base = PlanCoster.estimate(ref(100),
                Optional.of(stats(4)), query());
        final var zero = PlanCoster.estimate(ref(100),
                Optional.of(stats(4)), query(), 0.0);
        final var negative = PlanCoster.estimate(ref(100),
                Optional.of(stats(4)), query(), -1.0);
        assertThat(zero.selectivity()).isEqualTo(base.selectivity());
        assertThat(negative.selectivity()).isEqualTo(base.selectivity());
    }
}
