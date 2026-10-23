package ug.ac.mak.der.analytics;

import java.sql.ResultSet;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Reads the ADR-0020 facility summary + the recent rejection count. */
@Repository
public class AnalyticsRepository {

    private final JdbcTemplate jdbc;

    public AnalyticsRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public List<FacilitySummaryRow> summary(final String orgUnitId,
                                              final FacilitySummaryRow.Kind kind) {
        final StringBuilder sql = new StringBuilder(
                "SELECT org_unit_id, period, kind, n, refreshed_at "
                        + "FROM der.analytics_facility_summary WHERE 1 = 1");
        final List<Object> params = new ArrayList<>();
        if (orgUnitId != null && !orgUnitId.isBlank()) {
            sql.append(" AND org_unit_id = ?");
            params.add(orgUnitId);
        }
        if (kind != null) {
            sql.append(" AND kind = ?");
            params.add(kind.name());
        }
        sql.append(" ORDER BY period DESC, kind, org_unit_id LIMIT 1000");
        return jdbc.query(sql.toString(), rowMapper(), params.toArray());
    }

    public int recentRejections(final int limit) {
        final int capped = Math.max(1, Math.min(5000, limit));
        final Integer n = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM (SELECT 1 FROM der.security_audit "
                        + "WHERE event_type LIKE '%_REJECTED' "
                        + "ORDER BY observed_at DESC LIMIT ?) r",
                Integer.class, capped);
        return n == null ? 0 : n;
    }

    /** @return the refresh time of the most recent summary row, or
     *          {@code null} when the view is empty. */
    public Instant lastRefreshedAt() {
        return jdbc.query(
                "SELECT MAX(refreshed_at) FROM der.analytics_facility_summary",
                (ResultSet rs) -> rs.next()
                        ? (rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toInstant())
                        : null);
    }

    public void refresh() {
        jdbc.update(
                "REFRESH MATERIALIZED VIEW CONCURRENTLY der.analytics_facility_summary");
    }

    private RowMapper<FacilitySummaryRow> rowMapper() {
        return (ResultSet rs, int row) -> new FacilitySummaryRow(
                rs.getString("org_unit_id"),
                rs.getString("period"),
                FacilitySummaryRow.Kind.valueOf(rs.getString("kind")),
                rs.getLong("n"),
                rs.getTimestamp("refreshed_at").toInstant());
    }
}
