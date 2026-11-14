package ug.ac.mak.der.analytics.column.feedback;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.stereotype.Service;

/**
 * Per-shape workload aggregator feeding the Gate 8 preaggregation
 * proposer (SRS FR-INC-013). {@link PlanFeedbackStore} is a short ring
 * buffer sized for selectivity feedback; the proposer needs a longer
 * horizon of "how often did this shape run and how expensive was it",
 * so stats live in their own bounded LRU keyed by the same PHI-safe
 * shape key.
 *
 * <p>In-memory only in this slice — persistence lands when proposals
 * themselves become durable. Thread-safe via a single monitor; write
 * rate is bounded by {@code /query} throughput and reads are admin
 * inspection.</p>
 */
@Service
public class WorkloadStatsStore {

    private final int capacity;
    private final LinkedHashMap<String, WorkloadShapeStats> stats;

    public WorkloadStatsStore(final WorkloadStatsProperties properties) {
        Objects.requireNonNull(properties, "properties");
        this.capacity = properties.shapeCapacity();
        this.stats = new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(
                    final Map.Entry<String, WorkloadShapeStats> eldest) {
                return size() > WorkloadStatsStore.this.capacity;
            }
        };
    }

    public WorkloadStatsStore() {
        this(new WorkloadStatsProperties(1024));
    }

    public synchronized void observe(final PlanFeedback feedback) {
        Objects.requireNonNull(feedback, "feedback");
        final WorkloadShapeStats prev = stats.get(feedback.shapeKey());
        final Instant seenAt = feedback.observedAt();
        if (prev == null) {
            stats.put(feedback.shapeKey(), new WorkloadShapeStats(
                    feedback.shapeKey(), 1L,
                    Math.max(0L, feedback.elapsedMillis()),
                    Math.max(0.0, feedback.estimatedCost()),
                    Math.max(0L, feedback.actualRows()),
                    seenAt, seenAt));
            return;
        }
        final Instant first = prev.firstObservedAt().isBefore(seenAt)
                ? prev.firstObservedAt() : seenAt;
        final Instant last = prev.lastObservedAt().isAfter(seenAt)
                ? prev.lastObservedAt() : seenAt;
        stats.put(feedback.shapeKey(), new WorkloadShapeStats(
                prev.shapeKey(),
                prev.observations() + 1L,
                prev.sumElapsedMillis() + Math.max(0L, feedback.elapsedMillis()),
                prev.sumEstimatedCost() + Math.max(0.0, feedback.estimatedCost()),
                prev.sumActualRows() + Math.max(0L, feedback.actualRows()),
                first, last));
    }

    public synchronized Optional<WorkloadShapeStats> statsFor(
            final String shapeKey) {
        Objects.requireNonNull(shapeKey, "shapeKey");
        return Optional.ofNullable(stats.get(shapeKey));
    }

    public synchronized List<WorkloadShapeStats> top(final int limit) {
        final int n = Math.max(1, Math.min(limit, capacity));
        final List<WorkloadShapeStats> all = new ArrayList<>(stats.values());
        all.sort(Comparator
                .comparingDouble(WorkloadShapeStats::score).reversed()
                .thenComparing(WorkloadShapeStats::shapeKey));
        if (all.size() > n) {
            return new ArrayList<>(all.subList(0, n));
        }
        return all;
    }

    public synchronized int size() {
        return stats.size();
    }

    public int capacity() {
        return capacity;
    }

    public synchronized void clear() {
        stats.clear();
    }
}
