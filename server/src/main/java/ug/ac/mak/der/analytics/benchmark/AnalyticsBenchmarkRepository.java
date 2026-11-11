package ug.ac.mak.der.analytics.benchmark;

import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** JDBC layer for {@code der.analytics_benchmark_run} (V117). */
@Repository
public class AnalyticsBenchmarkRepository {

    private final JdbcTemplate jdbc;

    public AnalyticsBenchmarkRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public UUID insert(final AnalyticsBenchmarkRun run) {
        Objects.requireNonNull(run, "run");
        jdbc.update(
                "INSERT INTO der.analytics_benchmark_run ("
              + "  run_id, operation, iterations, p50_millis, p95_millis, "
              + "  p99_millis, max_millis, mean_millis, max_heap_bytes, "
              + "  scope, created_at) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), ?)",
                run.runId(), run.operation().name(), run.iterations(),
                run.p50Millis(), run.p95Millis(), run.p99Millis(),
                run.maxMillis(), run.meanMillis(),
                run.maxHeapBytes(),
                run.scopeJson() == null ? "{}" : run.scopeJson(),
                run.createdAt() == null ? Timestamp.from(java.time.Instant.now())
                        : Timestamp.from(run.createdAt()));
        return run.runId();
    }

    public List<AnalyticsBenchmarkRun> recent(
            final AnalyticsBenchmarkRun.Operation operation,
            final int limit) {
        final StringBuilder sql = new StringBuilder(
                "SELECT run_id, operation, iterations, p50_millis, "
              + "       p95_millis, p99_millis, max_millis, mean_millis, "
              + "       max_heap_bytes, scope::text AS scope_json, "
              + "       created_at "
              + "  FROM der.analytics_benchmark_run WHERE 1 = 1 ");
        final java.util.List<Object> args = new java.util.ArrayList<>();
        if (operation != null) {
            sql.append(" AND operation = ? ");
            args.add(operation.name());
        }
        sql.append(" ORDER BY created_at DESC LIMIT ? ");
        args.add(Math.max(1, Math.min(500, limit)));
        return jdbc.query(sql.toString(), MAPPER, args.toArray());
    }

    private static final RowMapper<AnalyticsBenchmarkRun> MAPPER =
        (rs, i) -> new AnalyticsBenchmarkRun(
                (UUID) rs.getObject("run_id"),
                AnalyticsBenchmarkRun.Operation.valueOf(
                        rs.getString("operation")),
                rs.getInt("iterations"),
                rs.getInt("p50_millis"),
                rs.getInt("p95_millis"),
                rs.getInt("p99_millis"),
                rs.getInt("max_millis"),
                rs.getInt("mean_millis"),
                (Long) rs.getObject("max_heap_bytes"),
                rs.getString("scope_json"),
                rs.getTimestamp("created_at") == null ? null
                        : rs.getTimestamp("created_at").toInstant());
}
