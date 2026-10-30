package ug.ac.mak.der.device;

import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** §2.2.9 device-to-device peer adjacency. Clients that discover a
 *  nearby peer radio report it; operators can also declare an adjacency
 *  manually. Topology view renders these as dashed device↔device edges. */
@Service
public class DeviceAdjacencyService {

    public enum LinkType { P2P, BLUETOOTH, WIFI_DIRECT, LORA, BLE_MESH }
    public enum State { ACTIVE, DEGRADED, OFFLINE }

    private final JdbcTemplate jdbc;

    public DeviceAdjacencyService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public List<Map<String, Object>> list() {
        return jdbc.query(
            "SELECT device_a_id, device_b_id, link_type, state, "
          + "first_seen_at, last_seen_at, reported_by "
          + "FROM der.edge_device_adjacency "
          + "ORDER BY last_seen_at DESC",
            (final ResultSet rs, final int rowNum) -> row(rs));
    }

    public List<Map<String, Object>> listFor(final UUID deviceId) {
        if (deviceId == null) {
            return List.of();
        }
        return jdbc.query(
            "SELECT device_a_id, device_b_id, link_type, state, "
          + "first_seen_at, last_seen_at, reported_by "
          + "FROM der.edge_device_adjacency "
          + "WHERE device_a_id = ? OR device_b_id = ? "
          + "ORDER BY last_seen_at DESC",
            (final ResultSet rs, final int rowNum) -> row(rs),
            deviceId, deviceId);
    }

    /** Idempotent upsert — pair ordered canonically so (a,b) and (b,a)
     *  share the same row.
     *
     *  @return the resulting (sorted) pair + state. */
    public Map<String, Object> upsert(final UUID left, final UUID right,
                                        final LinkType linkType, final State state,
                                        final UUID reportedBy) {
        if (left == null || right == null) {
            throw new IllegalArgumentException("both device ids required");
        }
        if (left.equals(right)) {
            throw new IllegalArgumentException("cannot pair a device with itself");
        }
        // Postgres UUID < uses lexicographic byte compare; match it with
        // String.compareTo (Java's UUID.compareTo is signed-long compare,
        // which disagrees for UUIDs whose high bits straddle sign).
        final UUID a = left.toString().compareTo(right.toString()) < 0 ? left : right;
        final UUID b = left.toString().compareTo(right.toString()) < 0 ? right : left;
        final String type = (linkType == null ? LinkType.P2P : linkType)
                .name().toLowerCase().replace('_', '-');
        final String s = (state == null ? State.ACTIVE : state).name().toLowerCase();
        jdbc.update(
            "INSERT INTO der.edge_device_adjacency "
          + "(device_a_id, device_b_id, link_type, state, "
          + " first_seen_at, last_seen_at, reported_by) "
          + "VALUES (?, ?, ?, ?, now(), now(), ?) "
          + "ON CONFLICT (device_a_id, device_b_id) DO UPDATE SET "
          + "  link_type   = EXCLUDED.link_type, "
          + "  state       = EXCLUDED.state, "
          + "  last_seen_at = now(), "
          + "  reported_by = EXCLUDED.reported_by",
            a, b, type, s, reportedBy);
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("deviceAId", a.toString());
        out.put("deviceBId", b.toString());
        out.put("linkType", type);
        out.put("state", s);
        return out;
    }

    public int delete(final UUID left, final UUID right) {
        if (left == null || right == null) {
            return 0;
        }
        // Postgres UUID < uses lexicographic byte compare; match it with
        // String.compareTo (Java's UUID.compareTo is signed-long compare,
        // which disagrees for UUIDs whose high bits straddle sign).
        final UUID a = left.toString().compareTo(right.toString()) < 0 ? left : right;
        final UUID b = left.toString().compareTo(right.toString()) < 0 ? right : left;
        return jdbc.update(
            "DELETE FROM der.edge_device_adjacency "
          + "WHERE device_a_id = ? AND device_b_id = ?",
            a, b);
    }

    private static Map<String, Object> row(final ResultSet rs) {
        try {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("deviceAId", rs.getString("device_a_id"));
            row.put("deviceBId", rs.getString("device_b_id"));
            row.put("linkType", rs.getString("link_type"));
            row.put("state", rs.getString("state"));
            row.put("firstSeenAt", rs.getTimestamp("first_seen_at").toInstant().toString());
            row.put("lastSeenAt",  rs.getTimestamp("last_seen_at").toInstant().toString());
            final String by = rs.getString("reported_by");
            row.put("reportedBy", by);
            return row;
        } catch (Exception ex) {
            return Map.of();
        }
    }
}
