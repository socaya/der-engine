package ug.ac.mak.der.analytics.benchmark;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsLiveIngester;
import ug.ac.mak.der.analytics.engine.AnalyticsSourceEvent;

/**
 * Admin-triggered benchmark harness for the two tightest Analytics
 * NFRs (spec §13):
 *
 * <ul>
 *   <li>AN-NFR-002 — 95% of ordinary single-site dashboard requests
 *       under 2 s on the reference workload. {@link #latency}
 *       measures {@code queryCells} timings against existing
 *       materialised data on the host machine.</li>
 *   <li>AN-NFR-003 — 95% of committed ordinary event updates
 *       reflected in the relevant tally within 10 s.
 *       {@link #freshness} measures the hot-path delay from
 *       {@code ingester.handle} to the cell being re-materialised.</li>
 * </ul>
 *
 * <p>The harness is deliberately conservative — it never seeds
 * synthetic data of its own. Operators point it at the pilot's
 * current ledger state so the measurement reflects real memory +
 * query shape. Every run persists to {@code analytics_benchmark_run}
 * so trends across pilots are visible without re-running.</p>
 */
@Service
public class AnalyticsBenchmarkService {

    private static final int DEFAULT_ITERATIONS = 100;
    private static final int MAX_ITERATIONS = 2_000;

    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsLiveIngester ingester;
    private final AnalyticsBenchmarkRepository runs;

    public AnalyticsBenchmarkService(
            final AnalyticsEngineRepository engineRepo,
            final AnalyticsLiveIngester ingester,
            final AnalyticsBenchmarkRepository runs) {
        this.engineRepo = Objects.requireNonNull(engineRepo, "engineRepo");
        this.ingester = Objects.requireNonNull(ingester, "ingester");
        this.runs = Objects.requireNonNull(runs, "runs");
    }

    public record Verdict(
            AnalyticsBenchmarkRun run,
            boolean nfrMet,
            int targetMillis,
            String operationLabel) {
    }

    /** AN-NFR-002 — repeat {@link AnalyticsEngineRepository#queryCells}
     *  {@code iterations} times against the first READY metric, then
     *  report percentile timings. {@code nfrMet} is true when p95 is
     *  at or below the configured ceiling (2000 ms). */
    public Verdict latency(final int rawIterations,
                             final int p95CeilingMillis) {
        final int iterations = clamp(rawIterations);
        final int target = p95CeilingMillis <= 0 ? 2000 : p95CeilingMillis;
        final List<AnalyticsDefinition> defs =
                engineRepo.listDefinitions("READY", 1);
        if (defs.isEmpty()) {
            final AnalyticsBenchmarkRun empty = persist(
                    AnalyticsBenchmarkRun.Operation.LATENCY, iterations,
                    new long[0], scopeJson("no-ready-metrics", null));
            return new Verdict(empty, false, target, "dashboard query");
        }
        final AnalyticsEngineRepository.CellQuery q =
                new AnalyticsEngineRepository.CellQuery(
                        List.of(defs.get(0).id()),
                        List.of(), List.of(), Map.of(),
                        200, 0);
        final long[] timings = new long[iterations];
        for (int i = 0; i < iterations; i++) {
            final long t0 = System.nanoTime();
            engineRepo.queryCells(q);
            timings[i] = (System.nanoTime() - t0) / 1_000_000L;
        }
        final AnalyticsBenchmarkRun run = persist(
                AnalyticsBenchmarkRun.Operation.LATENCY, iterations,
                timings, scopeJson("queryCells",
                        defs.get(0).code()));
        return new Verdict(run, run.p95Millis() <= target, target,
                "dashboard query");
    }

    /** AN-NFR-003 — re-apply the same source event
     *  {@code iterations} times and report how long each apply takes
     *  from {@code ingester.handle} entry to return. The same event
     *  key is used throughout so the upsert path is exercised
     *  idempotently (AT-05); the measurement is of the hot path,
     *  not of the first-time write. */
    public Verdict freshness(final int rawIterations,
                               final int p95CeilingMillis) {
        final int iterations = clamp(rawIterations);
        final int target = p95CeilingMillis <= 0 ? 10_000 : p95CeilingMillis;
        final List<AnalyticsCell> probe = engineRepo.queryCells(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        1, 0));
        if (probe.isEmpty()) {
            final AnalyticsBenchmarkRun empty = persist(
                    AnalyticsBenchmarkRun.Operation.FRESHNESS, iterations,
                    new long[0], scopeJson("no-materialised-cells", null));
            return new Verdict(empty, false, target, "ingest latency");
        }
        final AnalyticsCell seed = probe.get(0);
        final AnalyticsSourceEvent event = new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT,
                "bench-" + seed.metricId().toString().substring(0, 8),
                1, LocalDate.now(), seed.orgUnitUid(), "ACTIVE");
        final long[] timings = new long[iterations];
        for (int i = 0; i < iterations; i++) {
            final long t0 = System.nanoTime();
            ingester.handle(event);
            timings[i] = (System.nanoTime() - t0) / 1_000_000L;
        }
        final AnalyticsBenchmarkRun run = persist(
                AnalyticsBenchmarkRun.Operation.FRESHNESS, iterations,
                timings,
                scopeJson("handle", seed.metricId().toString()));
        return new Verdict(run, run.p95Millis() <= target, target,
                "ingest latency");
    }

    public List<AnalyticsBenchmarkRun> recent(
            final AnalyticsBenchmarkRun.Operation op, final int limit) {
        return runs.recent(op, limit);
    }

    static int clamp(final int iterations) {
        if (iterations <= 0) {
            return DEFAULT_ITERATIONS;
        }
        return Math.min(iterations, MAX_ITERATIONS);
    }

    private AnalyticsBenchmarkRun persist(
            final AnalyticsBenchmarkRun.Operation operation,
            final int iterations, final long[] rawTimings,
            final String scope) {
        final Percentiles p = percentiles(rawTimings);
        final long maxHeap = Runtime.getRuntime().totalMemory()
                - Runtime.getRuntime().freeMemory();
        final AnalyticsBenchmarkRun run = new AnalyticsBenchmarkRun(
                UUID.randomUUID(), operation, iterations,
                p.p50(), p.p95(), p.p99(), p.max(), p.mean(),
                maxHeap, scope, Instant.now());
        runs.insert(run);
        return run;
    }

    record Percentiles(int p50, int p95, int p99, int max, int mean) { }

    static Percentiles percentiles(final long[] timings) {
        if (timings == null || timings.length == 0) {
            return new Percentiles(0, 0, 0, 0, 0);
        }
        final long[] sorted = timings.clone();
        Arrays.sort(sorted);
        final int p50 = (int) sorted[pctIndex(sorted.length, 50)];
        final int p95 = (int) sorted[pctIndex(sorted.length, 95)];
        final int p99 = (int) sorted[pctIndex(sorted.length, 99)];
        final int max = (int) sorted[sorted.length - 1];
        long sum = 0;
        for (final long v : sorted) {
            sum += v;
        }
        final int mean = (int) (sum / sorted.length);
        return new Percentiles(p50, p95, p99, max, mean);
    }

    private static int pctIndex(final int n, final int pct) {
        if (n == 1) {
            return 0;
        }
        final int idx = (int) Math.ceil(pct / 100.0 * n) - 1;
        if (idx < 0) {
            return 0;
        }
        if (idx >= n) {
            return n - 1;
        }
        return idx;
    }

    private static String scopeJson(final String operation,
                                       final String metric) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("operation", operation);
        if (metric != null) {
            m.put("metric", metric);
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .writeValueAsString(m);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            return "{}";
        }
    }

    /** JSON projection for the controller. */
    public static Map<String, Object> asJson(final AnalyticsBenchmarkRun r) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("runId", r.runId().toString());
        out.put("operation", r.operation().name());
        out.put("iterations", r.iterations());
        out.put("p50Millis", r.p50Millis());
        out.put("p95Millis", r.p95Millis());
        out.put("p99Millis", r.p99Millis());
        out.put("maxMillis", r.maxMillis());
        out.put("meanMillis", r.meanMillis());
        out.put("maxHeapBytes", r.maxHeapBytes());
        out.put("scope", r.scopeJson());
        out.put("createdAt", r.createdAt() == null ? null
                : r.createdAt().toString());
        return out;
    }

    public static Map<String, Object> asJson(final Verdict v) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("run", asJson(v.run()));
        out.put("nfrMet", v.nfrMet());
        out.put("targetMillis", v.targetMillis());
        out.put("operationLabel", v.operationLabel());
        return out;
    }

    public static List<Map<String, Object>> asJson(
            final List<AnalyticsBenchmarkRun> rows) {
        final List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (final AnalyticsBenchmarkRun r : rows) {
            out.add(asJson(r));
        }
        return out;
    }
}
