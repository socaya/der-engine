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

    /** Upsert one contribution with version-aware reordering guard
     *  (SRS §12 fixture 7 + FR-ING-007). Only applies the update
     *  when the incoming {@code source_version} is at least as high
     *  as the stored one — numerically when both sides are digit
     *  strings, lexically otherwise. An older revision arriving
     *  after a newer one is silently dropped so current state never
     *  regresses. */
    public int upsert(final AnalyticsContribution c) {
        return jdbc.update(
                "INSERT INTO der.analytics_contribution ("
              + "  metric_id, definition_version, source_key, source_version, "
              + "  period_key, org_unit_uid, dimension_key, "
              + "  contribution_value, eligibility, source_state, "
              + "  numerator_contribution, denominator_contribution) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
              + "ON CONFLICT (metric_id, definition_version, source_key, "
              + "              period_key, org_unit_uid, dimension_key) "
              + "DO UPDATE SET "
              + "  source_version = EXCLUDED.source_version, "
              + "  contribution_value = EXCLUDED.contribution_value, "
              + "  eligibility = EXCLUDED.eligibility, "
              + "  source_state = EXCLUDED.source_state, "
              + "  numerator_contribution = EXCLUDED.numerator_contribution, "
              + "  denominator_contribution = EXCLUDED.denominator_contribution, "
              + "  updated_at = now() "
              + " WHERE " + VERSION_GUARD,
                c.metricId(), c.definitionVersion(), c.sourceKey(),
                c.sourceVersion(), c.periodKey(), c.orgUnitUid(),
                c.dimensionKey() == null ? "" : c.dimensionKey(),
                c.contributionValue() == null
                        ? BigDecimal.ZERO : c.contributionValue(),
                c.eligibility(), c.sourceState(),
                c.numeratorContribution(),
                c.denominatorContribution());
    }

    /** Postgres predicate that admits the UPDATE only when the
     *  incoming source_version is at least as high as the stored
     *  value. Castable numeric strings are compared numerically;
     *  anything else falls back to lexical compare so a non-digit
     *  version (hash, uuid) still has a stable total order. */
    private static final String VERSION_GUARD =
            "CASE "
          + "  WHEN der.analytics_contribution.source_version "
          + "       ~ '^[0-9]+$' "
          + "   AND EXCLUDED.source_version ~ '^[0-9]+$' "
          + "  THEN EXCLUDED.source_version::BIGINT "
          + "        >= der.analytics_contribution.source_version::BIGINT "
          + "  ELSE EXCLUDED.source_version "
          + "        >= der.analytics_contribution.source_version "
          + "END";

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
     *  Returns count + sum + min + max + ratio components so the
     *  materializer covers COUNT / SUM / MIN / MAX / ratio in one
     *  trip. min and max are null when the cell has no eligible
     *  contributions. */
    public CellAggregate aggregateForCell(final UUID metricId,
                                           final int definitionVersion,
                                           final String periodKey,
                                           final String orgUnitUid,
                                           final String dimensionKey) {
        return jdbc.queryForObject(
                "SELECT COUNT(*)::bigint AS n, "
              + "       COALESCE(SUM(contribution_value), 0) AS s, "
              + "       MIN(contribution_value) AS min_v, "
              + "       MAX(contribution_value) AS max_v, "
              + "       SUM(numerator_contribution) AS sum_num, "
              + "       SUM(denominator_contribution) AS sum_den "
              + "  FROM der.analytics_contribution "
              + " WHERE metric_id = ? AND definition_version = ? "
              + "   AND period_key = ? AND org_unit_uid = ? "
              + "   AND dimension_key = ? "
              + "   AND eligibility = TRUE AND source_state = 'COMMITTED'",
                (rs, i) -> new CellAggregate(
                        rs.getLong("n"), rs.getBigDecimal("s"),
                        rs.getBigDecimal("min_v"),
                        rs.getBigDecimal("max_v"),
                        rs.getBigDecimal("sum_num"),
                        rs.getBigDecimal("sum_den")),
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

    public record CellAggregate(long count, BigDecimal sum,
                                  BigDecimal min,
                                  BigDecimal max,
                                  BigDecimal sumNumerator,
                                  BigDecimal sumDenominator) {
        /** 2-arg legacy form for Phase 2 call sites + tests that
         *  predate ratio metrics. */
        public CellAggregate(final long count, final BigDecimal sum) {
            this(count, sum, null, null, null, null);
        }

        /** 4-arg ratio-only legacy form predating MIN/MAX support. */
        public CellAggregate(final long count, final BigDecimal sum,
                              final BigDecimal sumNumerator,
                              final BigDecimal sumDenominator) {
            this(count, sum, null, null, sumNumerator, sumDenominator);
        }
    }

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
                c.eligibility(), c.sourceState(),
                c.numeratorContribution(),
                c.denominatorContribution()
            });
        }
        return jdbc.batchUpdate(
                "INSERT INTO der.analytics_contribution ("
              + "  metric_id, definition_version, source_key, source_version, "
              + "  period_key, org_unit_uid, dimension_key, "
              + "  contribution_value, eligibility, source_state, "
              + "  numerator_contribution, denominator_contribution) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
              + "ON CONFLICT (metric_id, definition_version, source_key, "
              + "              period_key, org_unit_uid, dimension_key) "
              + "DO UPDATE SET "
              + "  source_version = EXCLUDED.source_version, "
              + "  contribution_value = EXCLUDED.contribution_value, "
              + "  eligibility = EXCLUDED.eligibility, "
              + "  source_state = EXCLUDED.source_state, "
              + "  numerator_contribution = EXCLUDED.numerator_contribution, "
              + "  denominator_contribution = EXCLUDED.denominator_contribution, "
              + "  updated_at = now() "
              + " WHERE " + VERSION_GUARD,
                args);
    }
}
