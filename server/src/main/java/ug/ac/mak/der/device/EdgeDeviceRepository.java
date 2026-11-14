package ug.ac.mak.der.device;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** JDBC repository for {@code der.edge_device}. ADR-0019. */
@Repository
public class EdgeDeviceRepository {

    private final JdbcTemplate jdbc;

    public EdgeDeviceRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public List<EdgeDevice> findAll() {
        return jdbc.query(
                selectAll() + " WHERE" + FLEET_SOURCE_CLAUSE
                        + " ORDER BY enrolled_at DESC",
                mapper());
    }

    public Optional<EdgeDevice> findById(final UUID deviceId) {
        if (deviceId == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    selectAll() + " WHERE device_id = ? AND"
                            + FLEET_SOURCE_CLAUSE,
                    mapper(), deviceId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /**
     * Idempotent enrol: inserts a PENDING row when the device is new,
     * updates user_agent + last_seen_at otherwise. Returns the resulting
     * row.
     */
    public EdgeDevice upsertEnrol(final UUID deviceId, final UUID actingUser,
                                    final String userAgent,
                                    final String enrolmentTokenHash) {
        Objects.requireNonNull(deviceId, "deviceId");
        final String inferredFormFactor = inferFormFactor(userAgent).name();
        jdbc.update(
                "INSERT INTO der.edge_device "
                        + "(device_id, assigned_user_id, enrolment_token_hash, "
                        + " enrolled_at, first_seen_at, last_seen_at, user_agent, "
                        + " status, source, form_factor) "
                        + "VALUES (?, ?, ?, now(), now(), now(), ?, 'PENDING', 'FLEET', ?) "
                        + "ON CONFLICT (device_id) DO UPDATE SET "
                        + "  last_seen_at = now(), "
                        + "  user_agent = COALESCE(EXCLUDED.user_agent, der.edge_device.user_agent), "
                        + "  assigned_user_id = COALESCE(der.edge_device.assigned_user_id, "
                        + "                               EXCLUDED.assigned_user_id), "
                        + "  source = CASE "
                        + "    WHEN der.edge_device.source = 'LAN' THEN 'BOTH' "
                        + "    ELSE der.edge_device.source "
                        + "  END, "
                        + "  form_factor = CASE "
                        + "    WHEN der.edge_device.form_factor = 'UNKNOWN' THEN EXCLUDED.form_factor "
                        + "    ELSE der.edge_device.form_factor "
                        + "  END",
                deviceId, actingUser, enrolmentTokenHash, userAgent, inferredFormFactor);
        return findById(deviceId).orElseThrow(() ->
                new IllegalStateException("enrol row disappeared"));
    }

    /** Best-effort form-factor inference from the user-agent string so
     *  a brand-new enrolment renders with the right icon in the mesh
     *  view. The admin-UI rename endpoint can still override. */
    static EdgeDevice.FormFactor inferFormFactor(final String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return EdgeDevice.FormFactor.UNKNOWN;
        }
        final String ua = userAgent.toLowerCase(java.util.Locale.ROOT);
        if (ua.contains("ipad") || ua.contains("tablet")
                || (ua.contains("android") && !ua.contains("mobile"))) {
            return EdgeDevice.FormFactor.TABLET;
        }
        if (ua.contains("iphone") || ua.contains("android")
                || ua.contains("mobile")) {
            return EdgeDevice.FormFactor.MOBILE;
        }
        if (ua.contains("macintosh") || ua.contains("mac os x")
                || ua.contains("windows") || ua.contains("linux")
                || ua.contains("x11")) {
            return EdgeDevice.FormFactor.LAPTOP;
        }
        return EdgeDevice.FormFactor.UNKNOWN;
    }

    public int updateStatus(final UUID deviceId, final EdgeDevice.Status status,
                              final UUID actor) {
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(status, "status");
        if (status == EdgeDevice.Status.APPROVED) {
            return jdbc.update(
                    "UPDATE der.edge_device SET status = 'APPROVED', "
                            + "approved_by = ?, approved_at = now() "
                            + "WHERE device_id = ?", actor, deviceId);
        }
        return jdbc.update(
                "UPDATE der.edge_device SET status = ? WHERE device_id = ?",
                status.name(), deviceId);
    }

    public int heartbeat(final UUID deviceId) {
        return heartbeat(deviceId, null, null);
    }

    public int heartbeat(final UUID deviceId, final String clientIp) {
        return heartbeat(deviceId, clientIp, null);
    }

    /** V120 — a heartbeat that carries the client IP + an auto-label
     *  (typically {@code "Client <port>"} derived from the Origin
     *  header) opportunistically stamps them on the row so FLEET-only
     *  devices acquire the LAN axis without a separate observation
     *  path. Both columns use COALESCE to preserve any authoritative
     *  value already present (an admin-set display_name or a real LAN
     *  observation). */
    public int heartbeat(final UUID deviceId, final String clientIp,
                             final String autoLabel) {
        if (deviceId == null) {
            return 0;
        }
        final boolean haveIp = clientIp != null && !clientIp.isBlank();
        final boolean haveLabel = autoLabel != null && !autoLabel.isBlank();
        if (!haveIp && !haveLabel) {
            return jdbc.update(
                    "UPDATE der.edge_device SET last_seen_at = now() "
                  + " WHERE device_id = ?",
                    deviceId);
        }
        return jdbc.update(
                "UPDATE der.edge_device SET last_seen_at = now(), "
              + "       ip = COALESCE(ip, ?), "
              + "       display_name = COALESCE(display_name, ?) "
              + " WHERE device_id = ?",
                haveIp ? clientIp : null,
                haveLabel ? autoLabel : null,
                deviceId);
    }

    public int delete(final UUID deviceId) {
        if (deviceId == null) {
            return 0;
        }
        return jdbc.update("DELETE FROM der.edge_device WHERE device_id = ?", deviceId);
    }

    /** V043: updates the operator-editable name + form factor. */
    public int updateProfile(final UUID deviceId, final String displayName,
                              final EdgeDevice.FormFactor formFactor) {
        if (deviceId == null) {
            return 0;
        }
        return jdbc.update(
                "UPDATE der.edge_device SET display_name = ?, form_factor = ? "
                        + "WHERE device_id = ?",
                displayName,
                (formFactor == null ? EdgeDevice.FormFactor.UNKNOWN : formFactor).name(),
                deviceId);
    }

    private String selectAll() {
        return "SELECT device_id, assigned_user_id, enrolment_token_hash, "
                + "enrolled_at, approved_by, approved_at, last_seen_at, "
                + "user_agent, firmware_version, status, "
                + "display_name, form_factor FROM der.edge_device";
    }

    /** V120 — the DHIS2 fleet view limits itself to rows with a
     *  session identity (FLEET-only or BOTH); pure-LAN observations
     *  surface through NetworkRepository instead. */
    private static final String FLEET_SOURCE_CLAUSE =
            " source IN ('FLEET','BOTH')";

    private RowMapper<EdgeDevice> mapper() {
        return (ResultSet rs, int row) -> new EdgeDevice(
                (UUID) rs.getObject("device_id"),
                (UUID) rs.getObject("assigned_user_id"),
                rs.getString("enrolment_token_hash"),
                rs.getTimestamp("enrolled_at").toInstant(),
                (UUID) rs.getObject("approved_by"),
                optInstant(rs.getTimestamp("approved_at")),
                optInstant(rs.getTimestamp("last_seen_at")),
                rs.getString("user_agent"),
                rs.getString("firmware_version"),
                EdgeDevice.Status.valueOf(rs.getString("status")),
                rs.getString("display_name"),
                EdgeDevice.FormFactor.valueOf(rs.getString("form_factor")));
    }

    private static Instant optInstant(final Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
}
