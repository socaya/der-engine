package ug.ac.mak.der.analytics.drilldown;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * JDBC layer for {@code der.analytics_drilldown_audit} (V114). Spec
 * §11: every drilldown or record-detail access against a cell writes
 * one row here <em>before</em> contributing sources are returned so
 * even an aborted response leaves a trail.
 */
@Repository
public class AnalyticsDrilldownAuditRepository {

    private final JdbcTemplate jdbc;

    public AnalyticsDrilldownAuditRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public UUID insert(final AnalyticsDrilldownAudit entry) {
        Objects.requireNonNull(entry, "entry");
        jdbc.update(
                "INSERT INTO der.analytics_drilldown_audit ("
              + "  audit_id, user_id, role, metric_id, definition_version, "
              + "  period_key, org_unit_uid, dimension_key, row_count, "
              + "  suppressed, purpose, client_ip) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                entry.auditId(), entry.userId(), entry.role(),
                entry.metricId(), entry.definitionVersion(),
                entry.periodKey(), entry.orgUnitUid(),
                entry.dimensionKey() == null ? "" : entry.dimensionKey(),
                entry.rowCount(), entry.suppressed(),
                entry.purpose(), entry.clientIp());
        return entry.auditId();
    }

    /** Recent accesses for a given user — for operator self-review
     *  pages ("what did I look at today?") and for reviewer-side
     *  compliance spot checks. */
    public List<AnalyticsDrilldownAudit> listForUser(final UUID userId,
                                                      final int limit) {
        return jdbc.query(
                "SELECT audit_id, user_id, role, metric_id, "
              + "       definition_version, period_key, org_unit_uid, "
              + "       dimension_key, row_count, suppressed, purpose, "
              + "       client_ip, created_at "
              + "  FROM der.analytics_drilldown_audit "
              + " WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                MAPPER, userId, limit);
    }

    /** Recent accesses against one cell — for reviewer dashboards
     *  tracking who looked at a sensitive diagnosis / small cell. */
    public List<AnalyticsDrilldownAudit> listForCell(final UUID metricId,
                                                      final String periodKey,
                                                      final String orgUnitUid,
                                                      final int limit) {
        return jdbc.query(
                "SELECT audit_id, user_id, role, metric_id, "
              + "       definition_version, period_key, org_unit_uid, "
              + "       dimension_key, row_count, suppressed, purpose, "
              + "       client_ip, created_at "
              + "  FROM der.analytics_drilldown_audit "
              + " WHERE metric_id = ? AND period_key = ? "
              + "   AND org_unit_uid = ? "
              + " ORDER BY created_at DESC LIMIT ?",
                MAPPER, metricId, periodKey, orgUnitUid, limit);
    }

    public long countAll() {
        final Long v = jdbc.queryForObject(
                "SELECT COUNT(*)::bigint FROM der.analytics_drilldown_audit",
                Long.class);
        return v == null ? 0L : v;
    }

    private static final RowMapper<AnalyticsDrilldownAudit> MAPPER =
        (rs, i) -> new AnalyticsDrilldownAudit(
                (UUID) rs.getObject("audit_id"),
                (UUID) rs.getObject("user_id"),
                rs.getString("role"),
                (UUID) rs.getObject("metric_id"),
                rs.getInt("definition_version"),
                rs.getString("period_key"),
                rs.getString("org_unit_uid"),
                rs.getString("dimension_key"),
                rs.getInt("row_count"),
                rs.getBoolean("suppressed"),
                rs.getString("purpose"),
                rs.getString("client_ip"),
                rs.getTimestamp("created_at") == null ? null
                        : rs.getTimestamp("created_at").toInstant());

    public record AnalyticsDrilldownAudit(
            UUID auditId, UUID userId, String role,
            UUID metricId, int definitionVersion,
            String periodKey, String orgUnitUid, String dimensionKey,
            int rowCount, boolean suppressed,
            String purpose, String clientIp, Instant createdAt) {
    }
}
