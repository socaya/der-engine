package ug.ac.mak.der.analytics.benchmark;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** One row of {@code der.analytics_benchmark_run} — the timing
 *  profile of a single admin-triggered benchmark pass. */
public record AnalyticsBenchmarkRun(
        UUID runId,
        Operation operation,
        int iterations,
        int p50Millis,
        int p95Millis,
        int p99Millis,
        int maxMillis,
        int meanMillis,
        Long maxHeapBytes,
        String scopeJson,
        Instant createdAt) {

    public AnalyticsBenchmarkRun {
        Objects.requireNonNull(runId, "runId");
        Objects.requireNonNull(operation, "operation");
    }

    public enum Operation { LATENCY, FRESHNESS }
}
