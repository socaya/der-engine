package ug.ac.mak.der.analytics.column.feedback;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class PlanFeedbackStoreTest {

    private PlanFeedbackStore store(final int capacity) {
        return new PlanFeedbackStore(
                new PlanFeedbackProperties(capacity));
    }

    private PlanFeedback feedback(final String engine,
                                     final String shape,
                                     final long est, final long actual) {
        return new PlanFeedback(Instant.now(), engine, shape,
                est, actual, 100.0, 10L);
    }

    @Test
    void recordAppendsAndSizeTracks() {
        final PlanFeedbackStore s = store(10);
        s.record(feedback("columnar", "s1", 10, 7));
        s.record(feedback("row_store", "s2", 20, 25));
        assertThat(s.size()).isEqualTo(2);
    }

    @Test
    void ringBufferEvictsOldestOnOverflow() {
        final PlanFeedbackStore s = store(3);
        s.record(feedback("columnar", "s1", 10, 1));
        s.record(feedback("columnar", "s2", 10, 2));
        s.record(feedback("columnar", "s3", 10, 3));
        s.record(feedback("columnar", "s4", 10, 4));
        assertThat(s.size()).isEqualTo(3);
        final List<PlanFeedback> recent = s.recent(10);
        // Newest first
        assertThat(recent.get(0).shapeKey()).isEqualTo("s4");
        assertThat(recent.get(2).shapeKey()).isEqualTo("s2");
    }

    @Test
    void recentReturnsNewestFirst() {
        final PlanFeedbackStore s = store(10);
        s.record(feedback("columnar", "s1", 10, 1));
        s.record(feedback("columnar", "s2", 10, 2));
        final List<PlanFeedback> r = s.recent(5);
        assertThat(r.get(0).shapeKey()).isEqualTo("s2");
        assertThat(r.get(1).shapeKey()).isEqualTo("s1");
    }

    @Test
    void averageRatioByShapeGroupsCorrectly() {
        final PlanFeedbackStore s = store(10);
        s.record(feedback("columnar", "s1", 10, 5));    // 0.5
        s.record(feedback("columnar", "s1", 10, 15));   // 1.5
        s.record(feedback("columnar", "s2", 10, 20));   // 2.0
        final Map<String, Double> avg = s.averageRatioByShape();
        assertThat(avg.get("s1"))
                .isCloseTo(1.0, org.assertj.core.data.Offset.offset(1e-3));
        assertThat(avg.get("s2"))
                .isCloseTo(2.0, org.assertj.core.data.Offset.offset(1e-3));
    }

    @Test
    void observedRatioClampsHighOutliers() {
        final PlanFeedback f = feedback("columnar", "s1", 1, 10_000);
        assertThat(f.observedRatio()).isEqualTo(10.0);
    }

    @Test
    void observedRatioHandlesZeroEstimate() {
        assertThat(feedback("columnar", "s1", 0, 0).observedRatio())
                .isEqualTo(1.0);
        assertThat(feedback("columnar", "s1", 0, 10).observedRatio())
                .isEqualTo(10.0);
    }

    @Test
    void clearEmptiesBuffer() {
        final PlanFeedbackStore s = store(10);
        s.record(feedback("columnar", "s1", 10, 5));
        s.clear();
        assertThat(s.size()).isZero();
    }

    @Test
    void shapeKeyIsStableAndPhiFree() {
        final UUID metric = UUID.randomUUID();
        final var q1 = new AnalyticsEngineRepository.CellQuery(
                List.of(metric), List.of("202611"),
                List.of("OU-A"), Map.of("sex", "F"), 100, 0);
        final var q2 = new AnalyticsEngineRepository.CellQuery(
                List.of(metric), List.of("202611"),
                List.of("OU-B"), Map.of("sex", "M"), 100, 0);
        // Same shape (same metric, same axis count, same dim name),
        // different values → same shape key.
        assertThat(PlanFeedbackStore.shapeKeyFor(q1))
                .isEqualTo(PlanFeedbackStore.shapeKeyFor(q2));
    }

    @Test
    void shapeKeyDifferentForDifferentDimensionNames() {
        final UUID metric = UUID.randomUUID();
        final var q1 = new AnalyticsEngineRepository.CellQuery(
                List.of(metric), List.of(), List.of(),
                Map.of("sex", "F"), 100, 0);
        final var q2 = new AnalyticsEngineRepository.CellQuery(
                List.of(metric), List.of(), List.of(),
                Map.of("age", "20"), 100, 0);
        assertThat(PlanFeedbackStore.shapeKeyFor(q1))
                .isNotEqualTo(PlanFeedbackStore.shapeKeyFor(q2));
    }
}
