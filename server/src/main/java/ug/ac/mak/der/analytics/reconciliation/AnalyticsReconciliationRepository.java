package ug.ac.mak.der.analytics.reconciliation;

import java.sql.Timestamp;
import java.util.ArrayList;
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
 * JDBC layer for {@code der.analytics_reconciliation} (V115).
 */
@Repository
public class AnalyticsReconciliationRepository {

    private final JdbcTemplate jdbc;

    public AnalyticsReconciliationRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public UUID upsert(final AnalyticsReconciliation r) {
        Objects.requireNonNull(r, "reconciliation");
        return jdbc.queryForObject(
                "INSERT INTO der.analytics_reconciliation ("
              + "  reconciliation_id, metric_id, definition_version, "
              + "  period_key, org_unit_uid, dimension_key, "
              + "  local_value, central_value, classification, "
              + "  explanation, central_refresh_at, local_source_cursor) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
              + "ON CONFLICT (metric_id, definition_version, period_key, "
              + "              org_unit_uid, dimension_key) "
              + "DO UPDATE SET "
              + "  local_value = EXCLUDED.local_value, "
              + "  central_value = EXCLUDED.central_value, "
              + "  classification = EXCLUDED.classification, "
              + "  explanation = EXCLUDED.explanation, "
              + "  central_refresh_at = EXCLUDED.central_refresh_at, "
              + "  local_source_cursor = EXCLUDED.local_source_cursor, "
              + "  updated_at = now() "
              + "RETURNING reconciliation_id",
                UUID.class,
                r.reconciliationId(), r.metricId(), r.definitionVersion(),
                r.periodKey(), r.orgUnitUid(), r.dimensionKey(),
                r.localValue(), r.centralValue(),
                r.classification().name(), r.explanation(),
                r.centralRefreshAt() == null ? null
                        : Timestamp.from(r.centralRefreshAt()),
                r.localSourceCursor());
    }

    public List<AnalyticsReconciliation> list(final UUID metricId,
                                                 final String classification,
                                                 final int limit) {
        final StringBuilder sql = new StringBuilder(
                "SELECT reconciliation_id, metric_id, definition_version, "
              + "       period_key, org_unit_uid, dimension_key, "
              + "       local_value, central_value, classification, "
              + "       explanation, central_refresh_at, "
              + "       local_source_cursor, created_at, updated_at "
              + "  FROM der.analytics_reconciliation WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (metricId != null) {
            sql.append(" AND metric_id = ? ");
            args.add(metricId);
        }
        if (classification != null && !classification.isBlank()) {
            sql.append(" AND classification = ? ");
            args.add(classification);
        }
        sql.append(" ORDER BY updated_at DESC LIMIT ? ");
        args.add(Math.max(1, Math.min(1000, limit)));
        return jdbc.query(sql.toString(), MAPPER, args.toArray());
    }

    public Optional<AnalyticsReconciliation> findById(final UUID id) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT reconciliation_id, metric_id, definition_version, "
                  + "       period_key, org_unit_uid, dimension_key, "
                  + "       local_value, central_value, classification, "
                  + "       explanation, central_refresh_at, "
                  + "       local_source_cursor, created_at, updated_at "
                  + "  FROM der.analytics_reconciliation "
                  + " WHERE reconciliation_id = ?",
                    MAPPER, id));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /** Classification histogram for the /quality + /reconciliation
     *  summary — every classification shows up even when its count
     *  is zero, so the UI renders a stable set of chips. */
    public Map<String, Integer> classificationCounts() {
        final Map<String, Integer> out = new LinkedHashMap<>();
        for (final ReconciliationClassifier.Classification c
                : ReconciliationClassifier.Classification.values()) {
            out.put(c.name(), 0);
        }
        jdbc.query(
                "SELECT classification, COUNT(*)::int AS n "
              + "  FROM der.analytics_reconciliation GROUP BY classification",
                (rs, i) -> {
                    out.put(rs.getString("classification"), rs.getInt("n"));
                    return null;
                });
        return out;
    }

    private static final RowMapper<AnalyticsReconciliation> MAPPER =
        (rs, i) -> new AnalyticsReconciliation(
                (UUID) rs.getObject("reconciliation_id"),
                (UUID) rs.getObject("metric_id"),
                rs.getInt("definition_version"),
                rs.getString("period_key"),
                rs.getString("org_unit_uid"),
                rs.getString("dimension_key"),
                rs.getBigDecimal("local_value"),
                rs.getBigDecimal("central_value"),
                ReconciliationClassifier.Classification.valueOf(
                        rs.getString("classification")),
                rs.getString("explanation"),
                rs.getTimestamp("central_refresh_at") == null ? null
                        : rs.getTimestamp("central_refresh_at").toInstant(),
                (Long) rs.getObject("local_source_cursor"),
                rs.getTimestamp("created_at") == null ? null
                        : rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at") == null ? null
                        : rs.getTimestamp("updated_at").toInstant());
}
