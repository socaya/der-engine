package ug.ac.mak.der.analytics.distributed;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** JDBC layer for {@code der.analytics_site_contribution} (V118). */
@Repository
public class SiteContributionRepository {

    private final JdbcTemplate jdbc;

    public SiteContributionRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Insert a verified packet. Returns true on first-write,
     *  false when the dedup key already holds a row. A unique-
     *  constraint violation is the expected "already seen" signal
     *  per SRS FR-DIS-003 — callers treat it as deduped, not an
     *  error. */
    public boolean insertIfAbsent(final SiteContributionPacket p) {
        Objects.requireNonNull(p, "packet");
        try {
            jdbc.update(
                    "INSERT INTO der.analytics_site_contribution ("
                  + "  packet_id, site_id, metric_id, definition_version, "
                  + "  period_key, org_unit_uid, dimension_key, "
                  + "  source_cursor, count_value, sum_value, min_value, "
                  + "  max_value, numerator_value, denominator_value, "
                  + "  produced_at, checksum_hex) "
                  + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                  + "ON CONFLICT ON CONSTRAINT "
                  + "  analytics_site_contribution_dedup DO NOTHING",
                    p.packetId(), p.siteId(), p.metricId(),
                    p.definitionVersion(), p.periodKey(),
                    p.orgUnitUid(), p.dimensionKey(),
                    p.sourceCursor(), p.count(), p.sum(),
                    p.min(), p.max(),
                    p.numerator(), p.denominator(),
                    Timestamp.from(p.producedAt()), p.checksumHex());
            return findByPacketId(p.packetId()).isPresent();
        } catch (DuplicateKeyException ex) {
            return false;
        }
    }

    public Optional<SiteContributionPacket> findByPacketId(
            final UUID packetId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT packet_id, site_id, metric_id, "
                  + "       definition_version, period_key, "
                  + "       org_unit_uid, dimension_key, source_cursor, "
                  + "       count_value, sum_value, min_value, max_value, "
                  + "       numerator_value, denominator_value, "
                  + "       produced_at, checksum_hex "
                  + "  FROM der.analytics_site_contribution "
                  + " WHERE packet_id = ?",
                    MAPPER, packetId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public long countBySite(final String siteId) {
        final Long v = jdbc.queryForObject(
                "SELECT COUNT(*)::bigint "
              + "  FROM der.analytics_site_contribution "
              + " WHERE site_id = ?",
                Long.class, siteId);
        return v == null ? 0L : v;
    }

    public long countPendingConsolidation() {
        final Long v = jdbc.queryForObject(
                "SELECT COUNT(*)::bigint "
              + "  FROM der.analytics_site_contribution "
              + " WHERE consolidated = FALSE",
                Long.class);
        return v == null ? 0L : v;
    }

    public List<Map<String, Object>> siteSummary() {
        return jdbc.query(
                "SELECT site_id, "
              + "       COUNT(*)::bigint AS packets, "
              + "       COUNT(*) FILTER (WHERE consolidated = FALSE) "
              + "           AS pending, "
              + "       MAX(received_at) AS last_received_at "
              + "  FROM der.analytics_site_contribution "
              + " GROUP BY site_id "
              + " ORDER BY site_id",
                (rs, i) -> {
                    final Map<String, Object> m =
                            new java.util.LinkedHashMap<>();
                    m.put("siteId", rs.getString("site_id"));
                    m.put("packets", rs.getLong("packets"));
                    m.put("pending", rs.getLong("pending"));
                    m.put("lastReceivedAt",
                            rs.getTimestamp("last_received_at") == null
                                    ? null
                                    : rs.getTimestamp("last_received_at")
                                            .toInstant().toString());
                    return m;
                });
    }

    /** Fetch every accepted packet matching an optional
     *  (metricIds, periodKeys) filter. Downstream consolidator
     *  groups by (metric, period, orgUnit, dim). */
    public List<SiteContributionPacket> findForQuery(
            final List<UUID> metricIds,
            final List<String> periodKeys,
            final int limit) {
        final StringBuilder sql = new StringBuilder(
                "SELECT packet_id, site_id, metric_id, "
              + "       definition_version, period_key, "
              + "       org_unit_uid, dimension_key, source_cursor, "
              + "       count_value, sum_value, min_value, max_value, "
              + "       numerator_value, denominator_value, "
              + "       produced_at, checksum_hex "
              + "  FROM der.analytics_site_contribution "
              + " WHERE 1 = 1 ");
        final java.util.List<Object> args = new java.util.ArrayList<>();
        if (metricIds != null && !metricIds.isEmpty()) {
            sql.append(" AND metric_id IN (")
                    .append("?,".repeat(metricIds.size()));
            sql.setLength(sql.length() - 1);
            sql.append(")");
            args.addAll(metricIds);
        }
        if (periodKeys != null && !periodKeys.isEmpty()) {
            sql.append(" AND period_key IN (")
                    .append("?,".repeat(periodKeys.size()));
            sql.setLength(sql.length() - 1);
            sql.append(")");
            args.addAll(periodKeys);
        }
        sql.append(" ORDER BY metric_id, period_key, org_unit_uid, "
                + "          dimension_key, site_id "
                + " LIMIT ?");
        args.add(Math.max(1, Math.min(limit, 10_000)));
        return jdbc.query(sql.toString(), MAPPER, args.toArray());
    }

    private static final RowMapper<SiteContributionPacket> MAPPER =
        (rs, i) -> new SiteContributionPacket(
                rs.getString("site_id"),
                (UUID) rs.getObject("packet_id"),
                (UUID) rs.getObject("metric_id"),
                rs.getInt("definition_version"),
                rs.getString("period_key"),
                rs.getString("org_unit_uid"),
                rs.getString("dimension_key"),
                rs.getLong("count_value"),
                getNullableDecimal(rs, "sum_value"),
                getNullableDecimal(rs, "min_value"),
                getNullableDecimal(rs, "max_value"),
                getNullableDecimal(rs, "numerator_value"),
                getNullableDecimal(rs, "denominator_value"),
                rs.getLong("source_cursor"),
                rs.getTimestamp("produced_at") == null
                        ? Instant.EPOCH
                        : rs.getTimestamp("produced_at").toInstant(),
                rs.getString("checksum_hex"),
                null);

    private static BigDecimal getNullableDecimal(
            final java.sql.ResultSet rs, final String col)
            throws java.sql.SQLException {
        final BigDecimal v = rs.getBigDecimal(col);
        return rs.wasNull() ? null : v;
    }
}
