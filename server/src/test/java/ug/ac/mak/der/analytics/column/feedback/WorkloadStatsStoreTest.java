package ug.ac.mak.der.analytics.column.feedback;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

class WorkloadStatsStoreTest {

    private WorkloadStatsStore store(final int capacity) {
        return new WorkloadStatsStore(
                new WorkloadStatsProperties(capacity));
    }

    private PlanFeedback feedback(final String shape,
                                     final long elapsed,
                                     final double cost,
                                     final long actualRows,
                                     final Instant at) {
        return new PlanFeedback(at, "columnar", shape,
                100L, actualRows, cost, elapsed);
    }

    @Test
    void firstObservationCreatesEntry() {
        final WorkloadStatsStore s = store(10);
        final Instant now = Instant.parse("2026-11-14T10:00:00Z");
        s.observe(feedback("s1", 25L, 500.0, 40L, now));
        final WorkloadShapeStats got = s.statsFor("s1").orElseThrow();
        assertThat(got.observations()).isEqualTo(1L);
        assertThat(got.sumElapsedMillis()).isEqualTo(25L);
        assertThat(got.sumEstimatedCost()).isEqualTo(500.0);
        assertThat(got.sumActualRows()).isEqualTo(40L);
        assertThat(got.firstObservedAt()).isEqualTo(now);
        assertThat(got.lastObservedAt()).isEqualTo(now);
    }

    @Test
    void repeatObservationsAccumulate() {
        final WorkloadStatsStore s = store(10);
        final Instant t0 = Instant.parse("2026-11-14T10:00:00Z");
        final Instant t1 = t0.plusSeconds(60);
        s.observe(feedback("s1", 10L, 100.0, 5L, t0));
        s.observe(feedback("s1", 30L, 200.0, 15L, t1));
        final WorkloadShapeStats got = s.statsFor("s1").orElseThrow();
        assertThat(got.observations()).isEqualTo(2L);
        assertThat(got.sumElapsedMillis()).isEqualTo(40L);
        assertThat(got.sumEstimatedCost()).isEqualTo(300.0);
        assertThat(got.sumActualRows()).isEqualTo(20L);
        assertThat(got.firstObservedAt()).isEqualTo(t0);
        assertThat(got.lastObservedAt()).isEqualTo(t1);
        assertThat(got.avgElapsedMillis()).isEqualTo(20.0);
        assertThat(got.avgEstimatedCost()).isEqualTo(150.0);
        assertThat(got.avgActualRows()).isEqualTo(10L);
    }

    @Test
    void firstAndLastAreOrderIndependent() {
        final WorkloadStatsStore s = store(10);
        final Instant earlier = Instant.parse("2026-11-14T09:00:00Z");
        final Instant later = earlier.plusSeconds(3600);
        s.observe(feedback("s1", 10L, 1.0, 1L, later));
        s.observe(feedback("s1", 10L, 1.0, 1L, earlier));
        final WorkloadShapeStats got = s.statsFor("s1").orElseThrow();
        assertThat(got.firstObservedAt()).isEqualTo(earlier);
        assertThat(got.lastObservedAt()).isEqualTo(later);
    }

    @Test
    void topRanksByScoreDescending() {
        final WorkloadStatsStore s = store(10);
        final Instant now = Instant.now();
        // s-cheap-frequent: 5 obs × 1ms = score 5
        for (int i = 0; i < 5; i++) {
            s.observe(feedback("s-cheap-frequent", 1L, 1.0, 1L, now));
        }
        // s-expensive-rare: 1 obs × 100ms = score 100
        s.observe(feedback("s-expensive-rare", 100L, 1.0, 1L, now));
        // s-sweet-spot: 4 obs × 50ms = score 200
        for (int i = 0; i < 4; i++) {
            s.observe(feedback("s-sweet-spot", 50L, 1.0, 1L, now));
        }
        final List<WorkloadShapeStats> top = s.top(3);
        assertThat(top.get(0).shapeKey()).isEqualTo("s-sweet-spot");
        assertThat(top.get(1).shapeKey()).isEqualTo("s-expensive-rare");
        assertThat(top.get(2).shapeKey()).isEqualTo("s-cheap-frequent");
    }

    @Test
    void capacityEvictsLeastRecentlyUsed() {
        final WorkloadStatsStore s = store(2);
        final Instant now = Instant.now();
        s.observe(feedback("s1", 10L, 1.0, 1L, now));
        s.observe(feedback("s2", 10L, 1.0, 1L, now));
        // Touch s1 so s2 becomes least-recently-used.
        s.observe(feedback("s1", 10L, 1.0, 1L, now));
        s.observe(feedback("s3", 10L, 1.0, 1L, now));
        assertThat(s.size()).isEqualTo(2);
        assertThat(s.statsFor("s2")).isEmpty();
        assertThat(s.statsFor("s1")).isPresent();
        assertThat(s.statsFor("s3")).isPresent();
    }

    @Test
    void negativeInputsClampToZero() {
        final WorkloadStatsStore s = store(10);
        // elapsedMillis / estimatedCost / actualRows all defensive.
        s.observe(new PlanFeedback(Instant.now(), "columnar", "s1",
                100L, -5L, -10.0, -1L));
        final WorkloadShapeStats got = s.statsFor("s1").orElseThrow();
        assertThat(got.sumElapsedMillis()).isZero();
        assertThat(got.sumEstimatedCost()).isZero();
        assertThat(got.sumActualRows()).isZero();
    }

    @Test
    void clearEmptiesStats() {
        final WorkloadStatsStore s = store(10);
        s.observe(feedback("s1", 10L, 1.0, 1L, Instant.now()));
        s.clear();
        assertThat(s.size()).isZero();
        assertThat(s.statsFor("s1")).isEmpty();
    }

    @Test
    void scoreIsZeroWhenNoObservations() {
        final WorkloadShapeStats empty = new WorkloadShapeStats(
                "s1", 0L, 0L, 0.0, 0L,
                Instant.EPOCH, Instant.EPOCH);
        assertThat(empty.score()).isZero();
        assertThat(empty.avgElapsedMillis()).isZero();
    }
}
