package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Data-access layer for {@code der.analytics_contribution}.
 *
 * <p>Separated from {@link AnalyticsEngineRepository} so Phase 1's
 * read surface tests don't drag in the ingestion schema. Phase 2
 * ingestion goes through this repo; the materializer reads rows via
 * {@link #aggregateForCell}, upserts individual rows via
 * {@link #upsert} and performs retraction via
 * {@link #removeForSource}.</p>
 */
@Repository
public class AnalyticsContributionRepository {

    private final JdbcTemplate jdbc;

    public AnalyticsContributionRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Upsert one contribution. Replays with the same
     *  (metric, source_key, period, orgUnit, dimension) tuple update
     *  value + eligibility + source_version idempotently. */
    public int upsert(final AnalyticsContribution c) {
        return jdbc.update(
                "INSERT INTO der.analytics_contribution ("
              + "  metric_id, definition_version, source_key, source_version, "
              + "  period_key, org_unit_uid, dimension_key, "
              + "  contribution_value, eligibility, source_state) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
              + "ON CONFLICT (metric_id, definition_version, source_key, "
              + "              period_key, org_unit_uid, dimension_key) "
              + "DO UPDATE SET "
              + "  source_version = EXCLUDED.source_version, "
              + "  contribution_value = EXCLUDED.contribution_value, "
              + "  eligibility = EXCLUDED.eligibility, "
              + "  source_state = EXCLUDED.source_state, "
              + "  updated_at = now()",
                c.metricId(), c.definitionVersion(), c.sourceKey(),
                c.sourceVersion(), c.periodKey(), c.orgUnitUid(),
                c.dimensionKey() == null ? "" : c.dimensionKey(),
                c.contributionValue() == null
                        ? BigDecimal.ZERO : c.contributionValue(),
                c.eligibility(), c.sourceState());
    }

    /** Remove every contribution for a source (across periods /
     *  dimensions / orgUnits). Used when a source is deleted or
     *  before re-materialising after a period / orgUnit change. */
    public int removeForSource(final UUID metricId, final int definitionVersion,
                                 final String sourceKey) {
        return jdbc.update(
                "DELETE FROM der.analytics_contribution "
              + " WHERE metric_id = ? AND definition_version = ? "
              + "   AND source_key = ?",
                metricId, definitionVersion, sourceKey);
    }

    /** Return the distinct cells a source's prior contributions
     *  touched — used by the materializer to know which cells to
     *  recompute after a retract. */
    public List<CellRef> cellsForSource(final UUID metricId,
                                          final int definitionVersion,
                                          final String sourceKey) {
        return jdbc.query(
                "SELECT DISTINCT period_key, org_unit_uid, dimension_key "
              + "  FROM der.analytics_contribution "
              + " WHERE metric_id = ? AND definition_version = ? "
              + "   AND source_key = ?",
                (rs, i) -> new CellRef(rs.getString("period_key"),
                        rs.getString("org_unit_uid"),
                        rs.getString("dimension_key")),
                metricId, definitionVersion, sourceKey);
    }

    /** Aggregate committed, eligible contributions for one cell.
     *  Returns (count, sum) so the materializer can cover both
     *  COUNT and SUM aggregation types without a second trip. */
    public CellAggregate aggregateForCell(final UUID metricId,
                                           final int definitionVersion,
                                           final String periodKey,
                                           final String orgUnitUid,
                                           final String dimensionKey) {
        return jdbc.queryForObject(
                "SELECT COUNT(*)::bigint AS n, "
              + "       COALESCE(SUM(contribution_value), 0) AS s "
              + "  FROM der.analytics_contribution "
              + " WHERE metric_id = ? AND definition_version = ? "
              + "   AND period_key = ? AND org_unit_uid = ? "
              + "   AND dimension_key = ? "
              + "   AND eligibility = TRUE AND source_state = 'COMMITTED'",
                (rs, i) -> new CellAggregate(
                        rs.getLong("n"), rs.getBigDecimal("s")),
                metricId, definitionVersion, periodKey, orgUnitUid,
                dimensionKey == null ? "" : dimensionKey);
    }

    /** Total contributions in the ledger — for /quality reporting. */
    public long countAll() {
        final Long v = jdbc.queryForObject(
                "SELECT COUNT(*)::bigint FROM der.analytics_contribution",
                Long.class);
        return v == null ? 0L : v;
    }

    public int clear() {
        return jdbc.update("DELETE FROM der.analytics_contribution");
    }

    /** List contributions for one source — small debug helper used
     *  by Phase-3 drilldown + ingestion unit tests. */
    public List<AnalyticsContribution> listForSource(final UUID metricId,
                                                      final int definitionVersion,
                                                      final String sourceKey) {
        return jdbc.query(
                "SELECT metric_id, definition_version, source_key, "
              + "       source_version, period_key, org_unit_uid, "
              + "       dimension_key, contribution_value, eligibility, "
              + "       source_state, created_at, updated_at "
              + "  FROM der.analytics_contribution "
              + " WHERE metric_id = ? AND definition_version = ? "
              + "   AND source_key = ? "
              + " ORDER BY period_key, org_unit_uid, dimension_key",
                CONTRIBUTION_MAPPER,
                metricId, definitionVersion, sourceKey);
    }

    public record CellRef(String periodKey, String orgUnitUid,
                            String dimensionKey) { }

    public record CellAggregate(long count, BigDecimal sum) { }

    private static final RowMapper<AnalyticsContribution> CONTRIBUTION_MAPPER =
        (rs, i) -> new AnalyticsContribution(
                (UUID) rs.getObject("metric_id"),
                rs.getInt("definition_version"),
                rs.getString("source_key"),
                rs.getString("source_version"),
                rs.getString("period_key"),
                rs.getString("org_unit_uid"),
                rs.getString("dimension_key"),
                rs.getBigDecimal("contribution_value"),
                rs.getBoolean("eligibility"),
                rs.getString("source_state"),
                toInstant(rs.getTimestamp("created_at")),
                toInstant(rs.getTimestamp("updated_at")));

    private static java.time.Instant toInstant(final Timestamp t) {
        return t == null ? null : t.toInstant();
    }

    /** Collect a batch of upserts in a single JDBC call. */
    public int[] upsertBatch(final List<AnalyticsContribution> rows) {
        if (rows == null || rows.isEmpty()) {
            return new int[0];
        }
        final List<Object[]> args = new ArrayList<>(rows.size());
        for (final AnalyticsContribution c : rows) {
            args.add(new Object[] {
                c.metricId(), c.definitionVersion(), c.sourceKey(),
                c.sourceVersion(), c.periodKey(), c.orgUnitUid(),
                c.dimensionKey() == null ? "" : c.dimensionKey(),
                c.contributionValue() == null
                        ? BigDecimal.ZERO : c.contributionValue(),
                c.eligibility(), c.sourceState()
            });
        }
        return jdbc.batchUpdate(
                "INSERT INTO der.analytics_contribution ("
              + "  metric_id, definition_version, source_key, source_version, "
              + "  period_key, org_unit_uid, dimension_key, "
              + "  contribution_value, eligibility, source_state) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
              + "ON CONFLICT (metric_id, definition_version, source_key, "
              + "              period_key, org_unit_uid, dimension_key) "
              + "DO UPDATE SET "
              + "  source_version = EXCLUDED.source_version, "
              + "  contribution_value = EXCLUDED.contribution_value, "
              + "  eligibility = EXCLUDED.eligibility, "
              + "  source_state = EXCLUDED.source_state, "
              + "  updated_at = now()",
                args);
    }
}
