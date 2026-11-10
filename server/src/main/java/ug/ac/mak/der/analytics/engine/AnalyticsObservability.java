package ug.ac.mak.der.analytics.engine;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Service;

/**
 * Lightweight in-memory counters for the analytics engine's hot
 * paths. Spec §4.7 "observability" + §10 "jobs" — the admin UI
 * needs a snapshot of ingestion lag, query p95 latency, failed
 * definitions and dead-letter counts to render the operations
 * panel without parsing logs.
 *
 * <p>Phase 6 keeps this in-process (no Prometheus wiring yet) so
 * the signal is cheap and doesn't require extra infrastructure on
 * the pilot facility edge. Values decay only on restart.</p>
 */
@Service
public class AnalyticsObservability {

    /** Rolling p95 buckets per endpoint — small reservoir (128
     *  samples) keeps memory bounded without a dependency. */
    private static final int RESERVOIR = 128;

    private final Map<String, Reservoir> latencyByOperation =
            new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> requestCountByOperation =
            new ConcurrentHashMap<>();
    private final AtomicLong suppressedCells = new AtomicLong();
    private final AtomicLong queryTimeouts = new AtomicLong();
    private final Instant startedAt = Instant.now();

    /** Record one operation duration. */
    public void record(final String operation, final long elapsedMs) {
        requestCountByOperation
                .computeIfAbsent(operation, k -> new AtomicLong())
                .incrementAndGet();
        latencyByOperation
                .computeIfAbsent(operation, k -> new Reservoir())
                .add(elapsedMs);
    }

    public void bumpSuppressed(final long n) {
        if (n > 0) {
            suppressedCells.addAndGet(n);
        }
    }

    public void bumpTimeouts() {
        queryTimeouts.incrementAndGet();
    }

    /** JSON-friendly snapshot for the /admin/observability endpoint. */
    public Map<String, Object> snapshot() {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("startedAt", startedAt.toString());
        out.put("uptimeSeconds",
                java.time.Duration.between(startedAt, Instant.now())
                        .getSeconds());
        out.put("suppressedCells", suppressedCells.get());
        out.put("queryTimeouts", queryTimeouts.get());
        final Map<String, Object> ops = new LinkedHashMap<>();
        for (final var e : latencyByOperation.entrySet()) {
            final Map<String, Object> m = new LinkedHashMap<>();
            final Reservoir r = e.getValue();
            m.put("count",
                    requestCountByOperation.get(e.getKey()).get());
            m.put("p50Ms", r.percentile(0.50));
            m.put("p95Ms", r.percentile(0.95));
            m.put("p99Ms", r.percentile(0.99));
            m.put("maxMs", r.max());
            ops.put(e.getKey(), m);
        }
        out.put("operations", ops);
        return out;
    }

    /** Fixed-size sample reservoir with simple percentile lookup.
     *  Not a full HdrHistogram — for a pilot-site workload (sub-
     *  million requests/day) the error band is acceptable and the
     *  cost is zero. */
    private static final class Reservoir {
        private final long[] samples = new long[RESERVOIR];
        private int size;
        private long nextIndex;
        private final Object lock = new Object();

        void add(final long v) {
            synchronized (lock) {
                if (size < RESERVOIR) {
                    samples[size++] = v;
                } else {
                    // Simple ring — overwrite in order. Good enough
                    // for the rolling-window property we want.
                    samples[(int) (nextIndex % RESERVOIR)] = v;
                }
                nextIndex++;
            }
        }

        long percentile(final double p) {
            synchronized (lock) {
                if (size == 0) {
                    return 0L;
                }
                final long[] copy = new long[size];
                System.arraycopy(samples, 0, copy, 0, size);
                java.util.Arrays.sort(copy);
                final int idx = Math.min(size - 1,
                        (int) Math.ceil(p * size) - 1);
                return copy[Math.max(0, idx)];
            }
        }

        long max() {
            synchronized (lock) {
                long m = 0;
                for (int i = 0; i < size; i++) {
                    if (samples[i] > m) {
                        m = samples[i];
                    }
                }
                return m;
            }
        }
    }
}
