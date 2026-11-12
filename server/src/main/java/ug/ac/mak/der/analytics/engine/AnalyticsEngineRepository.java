package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Data-access layer for the DER Analytics engine foundation tables
 * added in V110 ({@code der.analytics_definition} +
 * {@code der.analytics_cell} + {@code der.analytics_source_cursor}).
 *
 * <p>This repo is query-only in Phase 1. Phase 2 adds the contribution
 * ledger and the incremental materializer; those insert into
 * {@code analytics_cell} via a separate repo so the read surface stays
 * isolated from ingestion for the controller tests.</p>
 */
@Repository
public class AnalyticsEngineRepository {

    private final JdbcTemplate jdbc;

    public AnalyticsEngineRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /* ─────── Definition catalogue ─────── */

    public List<AnalyticsDefinition> listDefinitions(
            final String supportState, final int limit) {
        final int cap = Math.max(1, Math.min(limit, 500));
        final StringBuilder sql = new StringBuilder(
                "SELECT id, source_uid, code, display_name, "
              + "       definition_version, metadata_hash, analytics_type, "
              + "       aggregation_type, program_uid, stage_uids, "
              + "       date_anchor, org_unit_anchor, support_state, "
              + "       unsupported_reason, effective_from, "
              + "       created_at, updated_at "
              + "  FROM der.analytics_definition ");
        final List<Object> args = new ArrayList<>();
        if (supportState != null && !supportState.isBlank()) {
            sql.append(" WHERE support_state = ? ");
            args.add(supportState);
        }
        sql.append(" ORDER BY code, definition_version DESC LIMIT ?");
        args.add(cap);
        return jdbc.query(sql.toString(), DEFINITION_MAPPER, args.toArray());
    }

    /** Metrics whose {@code source_uid} points at a DHIS2 program
     *  indicator — i.e. imported via ProgramIndicatorSyncService.
     *  These are the ones central reconciliation can compare
     *  symmetrically because the formula is literally the same on
     *  both sides. Only READY metrics are returned so a parse
     *  regression doesn't trigger a phantom divergence. */
    public List<AnalyticsDefinition> listPiBackedMetrics(final int limit) {
        final int cap = Math.max(1, Math.min(limit, 500));
        return jdbc.query(
                "SELECT id, source_uid, code, display_name, "
              + "       definition_version, metadata_hash, analytics_type, "
              + "       aggregation_type, program_uid, stage_uids, "
              + "       date_anchor, org_unit_anchor, support_state, "
              + "       unsupported_reason, effective_from, "
              + "       created_at, updated_at "
              + "  FROM der.analytics_definition "
              + " WHERE support_state = 'READY' "
              + "   AND source_uid IS NOT NULL "
              + " ORDER BY code LIMIT ?",
                DEFINITION_MAPPER, cap);
    }

    public Optional<AnalyticsDefinition> findDefinition(final UUID id) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT id, source_uid, code, display_name, "
                  + "       definition_version, metadata_hash, analytics_type, "
                  + "       aggregation_type, program_uid, stage_uids, "
                  + "       date_anchor, org_unit_anchor, support_state, "
                  + "       unsupported_reason, effective_from, "
                  + "       created_at, updated_at "
                  + "  FROM der.analytics_definition WHERE id = ?",
                    DEFINITION_MAPPER, id));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public Optional<AnalyticsDefinition> findDefinitionByCode(final String code) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT id, source_uid, code, display_name, "
                  + "       definition_version, metadata_hash, analytics_type, "
                  + "       aggregation_type, program_uid, stage_uids, "
                  + "       date_anchor, org_unit_anchor, support_state, "
                  + "       unsupported_reason, effective_from, "
                  + "       created_at, updated_at "
                  + "  FROM der.analytics_definition WHERE code = ? "
                  + " ORDER BY definition_version DESC LIMIT 1",
                    DEFINITION_MAPPER, code));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public void insertDefinition(final AnalyticsDefinition d,
                                   final String compiledAstJson,
                                   final String definitionJson) {
        final String stageUids = d.stageUids() == null || d.stageUids().isEmpty()
                ? null : String.join(",", d.stageUids());
        jdbc.update(
                "INSERT INTO der.analytics_definition ("
              + "  id, source_uid, code, display_name, definition_version, "
              + "  metadata_hash, analytics_type, aggregation_type, "
              + "  program_uid, stage_uids, date_anchor, org_unit_anchor, "
              + "  compiled_ast, support_state, unsupported_reason, "
              + "  definition) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
              + "        CAST(? AS JSONB), ?, ?, CAST(? AS JSONB))",
                d.id(), d.sourceUid(), d.code(), d.displayName(),
                d.definitionVersion(), d.metadataHash(),
                d.analyticsType(), d.aggregationType(),
                d.programUid(), stageUids, d.dateAnchor(), d.orgUnitAnchor(),
                compiledAstJson, d.supportState(), d.unsupportedReason(),
                definitionJson == null ? "{}" : definitionJson);
    }

    /** Fetch the raw JSONB definition body — Phase 4b uses this to
     *  parse declared dimensions (and the OptionSet attached to each)
     *  without re-walking the catalogue. */
    public String loadDefinitionBody(final UUID id) {
        try {
            return jdbc.queryForObject(
                    "SELECT definition::text "
                  + "  FROM der.analytics_definition WHERE id = ?",
                    String.class, id);
        } catch (EmptyResultDataAccessException ex) {
            return null;
        }
    }

    /** Mark a definition's support state (READY / UNSUPPORTED /
     *  DEPRECATED / PARSED / IMPORTED) with an optional reason.
     *  Used by the admin deprecate endpoint + future recompile
     *  flows when metadata changes invalidate a prior AST. */
    public int updateSupportState(final UUID id, final String supportState,
                                    final String reason) {
        return jdbc.update(
                "UPDATE der.analytics_definition "
              + "   SET support_state = ?, unsupported_reason = ?, "
              + "       updated_at = now() "
              + " WHERE id = ?",
                supportState, reason, id);
    }

    /* ─────── Cell projection ─────── */

    public List<AnalyticsCell> queryCells(final CellQuery q) {
        Objects.requireNonNull(q, "query");
        final StringBuilder sql = new StringBuilder(
                "SELECT metric_id, definition_version, period_key, "
              + "       org_unit_uid, dimension_key, count_value, "
              + "       sum_value, value, numerator_value, "
              + "       denominator_value, freshness_at, quality_state "
              + "  FROM der.analytics_cell WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (q.metricIds() != null && !q.metricIds().isEmpty()) {
            sql.append(" AND metric_id IN (")
                    .append("?,".repeat(q.metricIds().size()));
            sql.setLength(sql.length() - 1);
            sql.append(") ");
            args.addAll(q.metricIds());
        }
        if (q.periodKeys() != null && !q.periodKeys().isEmpty()) {
            sql.append(" AND period_key IN (")
                    .append("?,".repeat(q.periodKeys().size()));
            sql.setLength(sql.length() - 1);
            sql.append(") ");
            args.addAll(q.periodKeys());
        }
        if (q.orgUnitUids() != null && !q.orgUnitUids().isEmpty()) {
            sql.append(" AND org_unit_uid IN (")
                    .append("?,".repeat(q.orgUnitUids().size()));
            sql.setLength(sql.length() - 1);
            sql.append(") ");
            args.addAll(q.orgUnitUids());
        }
        // Dimension filter — Phase 4a. Each entry binds a name to a
        // required value; the stored dimension_key is name=value|...
        // (sorted). We filter via LIKE on the sorted partial key so
        // the caller can supply any subset of the declared axes.
        if (q.dimensionFilter() != null && !q.dimensionFilter().isEmpty()) {
            for (final var e : q.dimensionFilter().entrySet()) {
                sql.append(" AND dimension_key LIKE ? ");
                // Match either `name=value` as a prefix or `|name=value`
                // mid-key, so the column may order axes arbitrarily so
                // long as the pair appears somewhere.
                args.add("%" + e.getKey() + "=" + e.getValue() + "%");
            }
        }
        sql.append(" ORDER BY metric_id, period_key, org_unit_uid "
                + " LIMIT ? OFFSET ?");
        args.add(Math.max(1, Math.min(q.limit(), 2000)));
        args.add(Math.max(0, q.offset()));
        return jdbc.query(sql.toString(), CELL_MAPPER, args.toArray());
    }

    public Map<String, Integer> qualityCounts() {
        final Map<String, Integer> out = new LinkedHashMap<>();
        for (final String s : Arrays.asList(
                "PROVISIONAL", "VERIFIED", "PROPOSED", "APPROVED",
                "PUBLISHED", "RECONCILED", "DIVERGED", "SUPPRESSED",
                "FAILED")) {
            out.put(s, 0);
        }
        jdbc.query(
                "SELECT quality_state, COUNT(*)::int AS c "
              + "  FROM der.analytics_cell GROUP BY quality_state",
                (rs, i) -> {
                    out.put(rs.getString("quality_state"), rs.getInt("c"));
                    return null;
                });
        return out;
    }

    public java.time.Instant latestFreshness() {
        final Timestamp ts = jdbc.queryForObject(
                "SELECT MAX(freshness_at) FROM der.analytics_cell",
                Timestamp.class);
        return ts == null ? null : ts.toInstant();
    }

    /* ─────── Source cursor ─────── */

    public long cursorFor(final String stream) {
        Objects.requireNonNull(stream, "stream");
        try {
            final Long v = jdbc.queryForObject(
                    "SELECT cursor_value FROM der.analytics_source_cursor "
                  + " WHERE stream = ?", Long.class, stream);
            return v == null ? 0L : v;
        } catch (EmptyResultDataAccessException ex) {
            return 0L;
        }
    }

    public Map<String, Long> allCursors() {
        final Map<String, Long> out = new LinkedHashMap<>();
        jdbc.query(
                "SELECT stream, cursor_value FROM der.analytics_source_cursor "
              + " ORDER BY stream",
                (rs, i) -> {
                    out.put(rs.getString("stream"), rs.getLong("cursor_value"));
                    return null;
                });
        return out;
    }

    public void upsertCursor(final String stream, final long cursor,
                               final int lagSeconds) {
        jdbc.update(
                "INSERT INTO der.analytics_source_cursor "
              + "  (stream, cursor_value, lag_seconds) "
              + "VALUES (?, ?, ?) "
              + "ON CONFLICT (stream) DO UPDATE SET "
              + "  cursor_value = EXCLUDED.cursor_value, "
              + "  lag_seconds = EXCLUDED.lag_seconds, "
              + "  updated_at = now()",
                stream, cursor, lagSeconds);
    }

    public int clearAllCells() {
        return jdbc.update("DELETE FROM der.analytics_cell");
    }

    /** Upsert one materialised cell. The materializer calls this
     *  after aggregating contributions for the cell's key. */
    public int upsertCell(final AnalyticsCell c) {
        return jdbc.update(
                "INSERT INTO der.analytics_cell ("
              + "  metric_id, definition_version, period_key, "
              + "  org_unit_uid, dimension_key, count_value, sum_value, "
              + "  value, numerator_value, denominator_value, "
              + "  freshness_at, quality_state) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), ?) "
              + "ON CONFLICT (metric_id, definition_version, period_key, "
              + "              org_unit_uid, dimension_key) "
              + "DO UPDATE SET "
              + "  count_value = EXCLUDED.count_value, "
              + "  sum_value = EXCLUDED.sum_value, "
              + "  value = EXCLUDED.value, "
              + "  numerator_value = EXCLUDED.numerator_value, "
              + "  denominator_value = EXCLUDED.denominator_value, "
              + "  freshness_at = now(), "
              + "  quality_state = EXCLUDED.quality_state",
                c.metricId(), c.definitionVersion(), c.periodKey(),
                c.orgUnitUid(),
                c.dimensionKey() == null ? "" : c.dimensionKey(),
                c.countValue(), c.sumValue(), c.value(),
                c.numeratorValue(), c.denominatorValue(),
                c.qualityState() == null ? "PROVISIONAL" : c.qualityState());
    }

    /** Delete a materialised cell — used when the last contribution
     *  for a cell is retracted so the UI stops showing stale zeros. */
    /** Single-cell lookup for drilldown (§11). Returns empty when the
     *  cell hasn't been materialised. */
    public Optional<AnalyticsCell> findCell(final UUID metricId,
                                              final int definitionVersion,
                                              final String periodKey,
                                              final String orgUnitUid,
                                              final String dimensionKey) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT metric_id, definition_version, period_key, "
                  + "       org_unit_uid, dimension_key, count_value, "
                  + "       sum_value, value, numerator, denominator, "
                  + "       freshness_at, quality_state "
                  + "  FROM der.analytics_cell "
                  + " WHERE metric_id = ? AND definition_version = ? "
                  + "   AND period_key = ? AND org_unit_uid = ? "
                  + "   AND dimension_key = ?",
                    CELL_MAPPER, metricId, definitionVersion, periodKey,
                    orgUnitUid, dimensionKey == null ? "" : dimensionKey));
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public int deleteCell(final UUID metricId, final int definitionVersion,
                            final String periodKey, final String orgUnitUid,
                            final String dimensionKey) {
        return jdbc.update(
                "DELETE FROM der.analytics_cell "
              + " WHERE metric_id = ? AND definition_version = ? "
              + "   AND period_key = ? AND org_unit_uid = ? "
              + "   AND dimension_key = ?",
                metricId, definitionVersion, periodKey, orgUnitUid,
                dimensionKey == null ? "" : dimensionKey);
    }

    /* ─────── Row mappers ─────── */

    private static final RowMapper<AnalyticsDefinition> DEFINITION_MAPPER =
        (rs, i) -> {
            final String stageUids = rs.getString("stage_uids");
            final List<String> stages = stageUids == null || stageUids.isBlank()
                    ? List.of()
                    : Arrays.stream(stageUids.split(",")).map(String::trim).toList();
            return new AnalyticsDefinition(
                    (UUID) rs.getObject("id"),
                    rs.getString("source_uid"),
                    rs.getString("code"),
                    rs.getString("display_name"),
                    rs.getInt("definition_version"),
                    rs.getString("metadata_hash"),
                    rs.getString("analytics_type"),
                    rs.getString("aggregation_type"),
                    rs.getString("program_uid"),
                    stages,
                    rs.getString("date_anchor"),
                    rs.getString("org_unit_anchor"),
                    rs.getString("support_state"),
                    rs.getString("unsupported_reason"),
                    toInstant(rs.getTimestamp("effective_from")),
                    toInstant(rs.getTimestamp("created_at")),
                    toInstant(rs.getTimestamp("updated_at")));
        };

    private static final RowMapper<AnalyticsCell> CELL_MAPPER =
        (rs, i) -> new AnalyticsCell(
                (UUID) rs.getObject("metric_id"),
                rs.getInt("definition_version"),
                rs.getString("period_key"),
                rs.getString("org_unit_uid"),
                rs.getString("dimension_key"),
                getNullableLong(rs, "count_value"),
                getNullableDecimal(rs, "sum_value"),
                getNullableDecimal(rs, "value"),
                getNullableDecimal(rs, "numerator_value"),
                getNullableDecimal(rs, "denominator_value"),
                toInstant(rs.getTimestamp("freshness_at")),
                rs.getString("quality_state"));

    private static java.time.Instant toInstant(final Timestamp t) {
        return t == null ? null : t.toInstant();
    }

    private static Long getNullableLong(final java.sql.ResultSet rs,
                                          final String col) throws java.sql.SQLException {
        final long v = rs.getLong(col);
        return rs.wasNull() ? null : v;
    }

    private static BigDecimal getNullableDecimal(final java.sql.ResultSet rs,
                                                    final String col) throws java.sql.SQLException {
        final BigDecimal v = rs.getBigDecimal(col);
        return rs.wasNull() ? null : v;
    }

    /** Query DTO for {@link #queryCells(CellQuery)}. The optional
     *  {@code dimensionFilter} binds a dimension name to a required
     *  value; the row's dimension_key must contain {@code name=value}
     *  for every entry in the map. */
    public record CellQuery(
            List<UUID> metricIds,
            List<String> periodKeys,
            List<String> orgUnitUids,
            Map<String, String> dimensionFilter,
            int limit,
            int offset) {

        /** Legacy 5-arg form retained for Phase 1-3 call sites that
         *  predate the dimension filter. */
        public CellQuery(final List<UUID> metricIds,
                           final List<String> periodKeys,
                           final List<String> orgUnitUids,
                           final int limit, final int offset) {
            this(metricIds, periodKeys, orgUnitUids, Map.of(),
                    limit, offset);
        }
    }
}
