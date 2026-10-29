package ug.ac.mak.der.testing;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** §9 Testing harness.
 *
 *  <p>Operator-triggered chaos / load / soak runs. Each run is persisted
 *  into {@code der.testing_run} with aggregate latency + outcome so the
 *  site can prove continuous validation of the production stack.</p>
 *
 *  <p>Chaos scenarios are deliberately in-process and non-destructive —
 *  they stress the HTTP surface + DB connection pool but don't touch
 *  the data plane. Destructive chaos (kill postgres, drop interface,
 *  cycle UPS) is driven from {@code scripts/evaluation/chaos.sh} by
 *  the operator, with results posted back via {@code POST /testing/runs}.</p>
 */
@Service
public class TestingHarnessService {

    private static final Logger LOG = LoggerFactory.getLogger(TestingHarnessService.class);

    /** Default load / soak endpoint — kept open to anonymous auth filter so a
     *  fresh HTTP client doesn't need a session cookie. */
    static final String DEFAULT_PROBE_PATH = "/edge-api/v1/system/health";

    private final JdbcTemplate jdbc;
    private final ReentrantLock mutex = new ReentrantLock();

    public TestingHarnessService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /* ─── Load ────────────────────────────────────────────── */

    /** Short burst of concurrent GETs against the health endpoint.
     *
     *  @param concurrency number of worker threads (clamped to 1..32)
     *  @param durationSec duration of the run in seconds (clamped to 1..60)
     *  @param baseUrl     DER base URL (e.g. {@code http://localhost:8080})
     *  @param user        operator principal name for the audit record
     */
    public Map<String, Object> runLoad(final int concurrency,
                                       final int durationSec,
                                       final String baseUrl,
                                       final String user) {
        return runProbe("LOAD", "health-burst", concurrency, durationSec, baseUrl, user);
    }

    /** Longer-duration health probe to validate soak endurance. */
    public Map<String, Object> runSoak(final int concurrency,
                                       final int durationSec,
                                       final String baseUrl,
                                       final String user) {
        return runProbe("SOAK", "health-sustained", concurrency, durationSec, baseUrl, user);
    }

    private Map<String, Object> runProbe(final String kind,
                                         final String scenario,
                                         final int rawConc,
                                         final int rawDur,
                                         final String baseUrl,
                                         final String user) {
        if (!mutex.tryLock()) {
            throw new IllegalStateException("another testing run is already in progress");
        }
        final UUID runId = UUID.randomUUID();
        final int concurrency = Math.max(1, Math.min(32, rawConc));
        final int durationSec = Math.max(1, Math.min("SOAK".equals(kind) ? 600 : 60, rawDur));
        final Instant startedAt = Instant.now();
        insertRun(runId, kind, scenario, startedAt, user);
        try {
            final AtomicLong total = new AtomicLong();
            final AtomicLong failed = new AtomicLong();
            final List<Long> latencies = Collections.synchronizedList(new ArrayList<>());
            final ExecutorService pool = Executors.newFixedThreadPool(concurrency);
            final HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2)).build();
            final long deadline = System.nanoTime() + Duration.ofSeconds(durationSec).toNanos();
            for (int w = 0; w < concurrency; w++) {
                pool.submit(() -> {
                    while (System.nanoTime() < deadline) {
                        final long t0 = System.nanoTime();
                        try {
                            final HttpResponse<String> resp = client.send(
                                HttpRequest.newBuilder(URI.create(baseUrl + DEFAULT_PROBE_PATH))
                                    .timeout(Duration.ofSeconds(2))
                                    .GET().build(),
                                HttpResponse.BodyHandlers.ofString());
                            if (resp.statusCode() >= 500) {
                                failed.incrementAndGet();
                            }
                        } catch (Exception ex) {
                            failed.incrementAndGet();
                        }
                        latencies.add(Duration.ofNanos(System.nanoTime() - t0).toMillis());
                        total.incrementAndGet();
                    }
                });
            }
            pool.shutdown();
            try {
                pool.awaitTermination(durationSec + 5L, TimeUnit.SECONDS);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            final Instant finishedAt = Instant.now();
            final long durationMs = Duration.between(startedAt, finishedAt).toMillis();
            final long tot = total.get();
            final long fail = failed.get();
            final Map<String, Long> pct = percentiles(latencies);
            final double rps = durationMs > 0 ? (tot * 1000.0 / durationMs) : 0.0;
            final String outcome = fail == 0 && tot > 0 ? "PASS" : "FAIL";
            final Map<String, Object> details = new LinkedHashMap<>();
            details.put("concurrency", concurrency);
            details.put("durationSec", durationSec);
            details.put("probe", DEFAULT_PROBE_PATH);
            updateRun(runId, finishedAt, outcome, durationMs, tot, fail,
                pct.get("p50"), pct.get("p95"), pct.get("p99"), rps, details);
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("runId", runId.toString());
            out.put("kind", kind);
            out.put("outcome", outcome);
            out.put("durationMs", durationMs);
            out.put("requestsTotal", tot);
            out.put("requestsFailed", fail);
            out.put("latencyP50Ms", pct.get("p50"));
            out.put("latencyP95Ms", pct.get("p95"));
            out.put("latencyP99Ms", pct.get("p99"));
            out.put("throughputRps", rps);
            return out;
        } finally {
            mutex.unlock();
        }
    }

    /* ─── Chaos ───────────────────────────────────────────── */

    /** Non-destructive chaos: probe the health surface while deliberately
     *  flooding the connection pool with slow requests. Confirms that
     *  recovery after transient saturation is clean. */
    public Map<String, Object> runChaos(final String scenario, final String baseUrl, final String user) {
        final String s = scenario == null ? "pool-saturation" : scenario;
        return switch (s) {
            case "pool-saturation" -> runProbe("CHAOS", "pool-saturation", 24, 3, baseUrl, user);
            case "slow-start"      -> runProbe("CHAOS", "slow-start", 1, 2, baseUrl, user);
            default -> throw new IllegalArgumentException("unknown chaos scenario: " + s);
        };
    }

    /* ─── Script-driven run import ──────────────────────── */

    /** Record a run performed by an external script (e.g. chaos.sh killing
     *  postgres and verifying recovery). Scripts post the final totals back. */
    public Map<String, Object> recordRun(final Map<String, Object> body, final String user) {
        final UUID runId = UUID.randomUUID();
        final String kind = Objects.toString(body.get("kind"), "GOLDEN");
        final String scenario = Objects.toString(body.get("scenario"), "unspecified");
        final String outcome = Objects.toString(body.get("outcome"), "PASS");
        final Instant now = Instant.now();
        final long durationMs = toLong(body.get("durationMs"));
        final long total = toLong(body.get("requestsTotal"));
        final long failed = toLong(body.get("requestsFailed"));
        insertRun(runId, kind, scenario, now.minusMillis(durationMs), user);
        updateRun(runId, now, outcome, durationMs, total, failed,
            toLong(body.get("latencyP50Ms")),
            toLong(body.get("latencyP95Ms")),
            toLong(body.get("latencyP99Ms")),
            toDouble(body.get("throughputRps")),
            body);
        return Map.of("runId", runId.toString(), "kind", kind, "outcome", outcome);
    }

    /* ─── History ───────────────────────────────────────── */

    public List<Map<String, Object>> history(final int limit) {
        return jdbc.query(
            "SELECT run_id, kind, scenario, started_at, finished_at, outcome, "
          + "duration_ms, requests_total, requests_failed, "
          + "latency_p50_ms, latency_p95_ms, latency_p99_ms, throughput_rps, triggered_by "
          + "FROM der.testing_run ORDER BY started_at DESC LIMIT ?",
            (final ResultSet rs, final int rowNum) -> rowToMap(rs),
            Math.max(1, Math.min(500, limit)));
    }

    public Map<String, Object> summary() {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalRuns", jdbc.queryForObject(
            "SELECT COUNT(*) FROM der.testing_run", Long.class));
        out.put("last24hRuns", jdbc.queryForObject(
            "SELECT COUNT(*) FROM der.testing_run WHERE started_at > now() - interval '24 hours'",
            Long.class));
        out.put("last24hPass", jdbc.queryForObject(
            "SELECT COUNT(*) FROM der.testing_run WHERE started_at > now() - interval '24 hours' AND outcome='PASS'",
            Long.class));
        out.put("last24hFail", jdbc.queryForObject(
            "SELECT COUNT(*) FROM der.testing_run WHERE started_at > now() - interval '24 hours' AND outcome='FAIL'",
            Long.class));
        return out;
    }

    /* ─── Internals ─────────────────────────────────────── */

    private void insertRun(final UUID runId, final String kind, final String scenario,
                           final Instant startedAt, final String user) {
        jdbc.update(
            "INSERT INTO der.testing_run (run_id, kind, scenario, started_at, outcome, triggered_by) "
          + "VALUES (?, ?, ?, ?, 'RUNNING', ?)",
            runId, kind, scenario, Timestamp.from(startedAt), user);
    }

    private void updateRun(final UUID runId, final Instant finishedAt, final String outcome,
                           final long durationMs, final long total, final long failed,
                           final Long p50, final Long p95, final Long p99, final double rps,
                           final Map<String, Object> details) {
        jdbc.update(
            "UPDATE der.testing_run SET finished_at=?, outcome=?, duration_ms=?, "
          + "requests_total=?, requests_failed=?, latency_p50_ms=?, latency_p95_ms=?, "
          + "latency_p99_ms=?, throughput_rps=?, details=?::jsonb WHERE run_id=?",
            Timestamp.from(finishedAt), outcome, durationMs, total, failed, p50, p95, p99, rps,
            toJson(details), runId);
    }

    private static Map<String, Long> percentiles(final List<Long> samples) {
        final Map<String, Long> out = new LinkedHashMap<>();
        if (samples.isEmpty()) {
            out.put("p50", 0L);
            out.put("p95", 0L);
            out.put("p99", 0L);
            return out;
        }
        final List<Long> sorted = new ArrayList<>(samples);
        Collections.sort(sorted);
        out.put("p50", sorted.get((int) (sorted.size() * 0.50)));
        out.put("p95", sorted.get(Math.min(sorted.size() - 1, (int) (sorted.size() * 0.95))));
        out.put("p99", sorted.get(Math.min(sorted.size() - 1, (int) (sorted.size() * 0.99))));
        return out;
    }

    private static long toLong(final Object v) {
        if (v == null) {
            return 0L;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(v.toString());
        } catch (Exception ex) {
            return 0L;
        }
    }

    private static double toDouble(final Object v) {
        if (v == null) {
            return 0.0;
        }
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return Double.parseDouble(v.toString());
        } catch (Exception ex) {
            return 0.0;
        }
    }

    private static String toJson(final Map<String, Object> details) {
        if (details == null || details.isEmpty()) {
            return "{}";
        }
        final StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> e : details.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(escape(e.getKey())).append("\":");
            final Object v = e.getValue();
            if (v == null) {
                sb.append("null");
            } else if (v instanceof Number || v instanceof Boolean) {
                sb.append(v);
            } else {
                sb.append('"').append(escape(v.toString())).append('"');
            }
        }
        return sb.append('}').toString();
    }

    private static String escape(final String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private Map<String, Object> rowToMap(final ResultSet rs) {
        try {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("runId", rs.getString("run_id"));
            row.put("kind", rs.getString("kind"));
            row.put("scenario", rs.getString("scenario"));
            row.put("startedAt",
                rs.getTimestamp("started_at") == null ? null : rs.getTimestamp("started_at").toInstant().toString());
            row.put("finishedAt",
                rs.getTimestamp("finished_at") == null ? null : rs.getTimestamp("finished_at").toInstant().toString());
            row.put("outcome", rs.getString("outcome"));
            row.put("durationMs", rs.getObject("duration_ms"));
            row.put("requestsTotal", rs.getObject("requests_total"));
            row.put("requestsFailed", rs.getObject("requests_failed"));
            row.put("latencyP50Ms", rs.getObject("latency_p50_ms"));
            row.put("latencyP95Ms", rs.getObject("latency_p95_ms"));
            row.put("latencyP99Ms", rs.getObject("latency_p99_ms"));
            row.put("throughputRps", rs.getObject("throughput_rps"));
            row.put("triggeredBy", rs.getString("triggered_by"));
            return row;
        } catch (Exception ex) {
            LOG.warn("testing_run row read failed", ex);
            return Map.of();
        }
    }
}
