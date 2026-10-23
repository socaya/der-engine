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
        return jdbc.query(selectAll() + " ORDER BY enrolled_at DESC", mapper());
    }

    public Optional<EdgeDevice> findById(final UUID deviceId) {
        if (deviceId == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    selectAll() + " WHERE device_id = ?", mapper(), deviceId));
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
        jdbc.update(
                "INSERT INTO der.edge_device "
                        + "(device_id, assigned_user_id, enrolment_token_hash, "
                        + " enrolled_at, last_seen_at, user_agent, status) "
                        + "VALUES (?, ?, ?, now(), now(), ?, 'PENDING') "
                        + "ON CONFLICT (device_id) DO UPDATE SET "
                        + "  last_seen_at = now(), "
                        + "  user_agent = COALESCE(EXCLUDED.user_agent, der.edge_device.user_agent), "
                        + "  assigned_user_id = COALESCE(der.edge_device.assigned_user_id, "
                        + "                               EXCLUDED.assigned_user_id)",
                deviceId, actingUser, enrolmentTokenHash, userAgent);
        return findById(deviceId).orElseThrow(() ->
                new IllegalStateException("enrol row disappeared"));
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
        if (deviceId == null) {
            return 0;
        }
        return jdbc.update(
                "UPDATE der.edge_device SET last_seen_at = now() WHERE device_id = ?",
                deviceId);
    }

    public int delete(final UUID deviceId) {
        if (deviceId == null) {
            return 0;
        }
        return jdbc.update("DELETE FROM der.edge_device WHERE device_id = ?", deviceId);
    }

    private String selectAll() {
        return "SELECT device_id, assigned_user_id, enrolment_token_hash, "
                + "enrolled_at, approved_by, approved_at, last_seen_at, "
                + "user_agent, firmware_version, status FROM der.edge_device";
    }

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
                EdgeDevice.Status.valueOf(rs.getString("status")));
    }

    private static Instant optInstant(final Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
}
