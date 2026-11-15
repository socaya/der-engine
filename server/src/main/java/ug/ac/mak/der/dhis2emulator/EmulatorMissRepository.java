package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC layer over {@code der.emulator_miss} (V122). Bounded-cardinality
 * counter of unmirrored {@code /api/*} hits per (endpoint, appOrigin)
 * tuple — fed by the catch-all / proxy fallback, drained by the
 * {@code /system/apps} admin diagnostic (FR-DIAG-002).
 *
 * <p>The write path is {@code INSERT … ON CONFLICT DO UPDATE SET
 * hit_count = hit_count + 1, last_at = now()} so the whole thing stays
 * safe under concurrent miss recording and doesn't require a Java-side
 * mutex.
 */
@Repository
public class EmulatorMissRepository {

    private final JdbcTemplate jdbc;

    public EmulatorMissRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Record one unmirrored hit. {@code appOrigin} may be empty. */
    public void record(final String endpoint, final String appOrigin) {
        if (endpoint == null || endpoint.isBlank()) {
            return;
        }
        final String origin = appOrigin == null ? "" : appOrigin;
        jdbc.update(
                "INSERT INTO der.emulator_miss "
                        + "(endpoint, app_origin, hit_count, first_at, last_at) "
                        + "VALUES (?, ?, 1, now(), now()) "
                        + "ON CONFLICT (endpoint, app_origin) DO UPDATE SET "
                        + "  hit_count = der.emulator_miss.hit_count + 1, "
                        + "  last_at = now()",
                endpoint, origin);
    }

    public List<Row> topRecent(final int limit) {
        final int cap = Math.max(1, Math.min(limit, 500));
        final List<Row> out = new ArrayList<>();
        jdbc.query(
                "SELECT endpoint, app_origin, hit_count, first_at, last_at "
                        + "FROM der.emulator_miss "
                        + "ORDER BY last_at DESC "
                        + "LIMIT ?",
                rs -> {
                    out.add(new Row(
                            rs.getString(1),
                            rs.getString(2),
                            rs.getLong(3),
                            rs.getTimestamp(4).toInstant().toString(),
                            rs.getTimestamp(5).toInstant().toString()));
                }, cap);
        return out;
    }

    public record Row(String endpoint,
                      String appOrigin,
                      long hitCount,
                      String firstAt,
                      String lastAt) { }
}
