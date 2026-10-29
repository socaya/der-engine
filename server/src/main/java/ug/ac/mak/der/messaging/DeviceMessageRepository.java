package ug.ac.mak.der.messaging;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Phase N5 — DER-MSG v1 persistence. One repo covers message insert,
 *  channel scan, subscription cursor, and per-device ack. */
@Repository
public class DeviceMessageRepository {

    private final JdbcTemplate jdbc;

    public DeviceMessageRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public UUID insertMessage(final String channel, final String fromDevice,
                                final UUID fromUser, final String type,
                                final String payloadJson, final UUID replyTo,
                                final Instant expiresAt) {
        return insertMessage(channel, fromDevice, fromUser, type, payloadJson,
                              replyTo, expiresAt, false, null, null, null);
    }

    public UUID insertMessage(final String channel, final String fromDevice,
                                final UUID fromUser, final String type,
                                final String payloadJson, final UUID replyTo,
                                final Instant expiresAt, final boolean encrypted,
                                final String recipientDeviceId,
                                final String senderEphemeralPubkey,
                                final String nonce) {
        final UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO der.device_message "
          + "(message_id, channel, from_device_id, from_user_id, message_type, "
          + " payload, reply_to, expires_at, encrypted, recipient_device_id, "
          + " sender_ephemeral_pubkey, nonce) "
          + "VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?)",
            id, channel, fromDevice, fromUser, type, payloadJson, replyTo,
            expiresAt == null ? null : Timestamp.from(expiresAt),
            encrypted, recipientDeviceId, senderEphemeralPubkey, nonce);
        return id;
    }

    /** Pull messages on a specific channel, newer than {@code sinceCursor}.
     *  Expired messages are skipped so devices that return after a long
     *  offline window don't see stale alerts. */
    public List<Map<String, Object>> channelScan(final List<String> channels,
                                                    final Instant since,
                                                    final int limit) {
        if (channels == null || channels.isEmpty()) {
            return List.of();
        }
        final String placeholders = String.join(",", java.util.Collections.nCopies(channels.size(), "?"));
        final Object[] args = new Object[channels.size() + 3];
        for (int i = 0; i < channels.size(); i++) {
            args[i] = channels.get(i);
        }
        args[channels.size()]     = Timestamp.from(since == null ? Instant.EPOCH : since);
        args[channels.size() + 1] = Timestamp.from(Instant.now());
        args[channels.size() + 2] = Math.max(1, Math.min(limit, 500));
        return jdbc.query(
            "SELECT message_id, channel, from_device_id, from_user_id, "
          + "       message_type, payload::text AS payload, reply_to, "
          + "       expires_at, created_at, encrypted, recipient_device_id, "
          + "       sender_ephemeral_pubkey, nonce "
          + "  FROM der.device_message "
          + " WHERE channel IN (" + placeholders + ") "
          + "   AND created_at > ? "
          + "   AND (expires_at IS NULL OR expires_at > ?) "
          + " ORDER BY created_at ASC LIMIT ?",
            (ResultSet rs, int row) -> rowMap(rs),
            args);
    }

    public List<Map<String, Object>> recentAcrossChannels(final int limit) {
        return jdbc.query(
            "SELECT message_id, channel, from_device_id, from_user_id, "
          + "       message_type, payload::text AS payload, reply_to, "
          + "       expires_at, created_at, encrypted, recipient_device_id, "
          + "       sender_ephemeral_pubkey, nonce "
          + "  FROM der.device_message "
          + " ORDER BY created_at DESC LIMIT ?",
            (ResultSet rs, int row) -> rowMap(rs),
            Math.max(1, Math.min(limit, 200)));
    }

    public Map<String, Object> stats() {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("messagesTotal", jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM der.device_message", Integer.class));
        m.put("devicesSubscribed", jdbc.queryForObject(
            "SELECT COUNT(DISTINCT device_id)::int FROM der.device_subscription",
            Integer.class));
        m.put("channelsActive", jdbc.queryForObject(
            "SELECT COUNT(DISTINCT channel)::int FROM der.device_message "
          + "WHERE created_at > now() - interval '1 hour'", Integer.class));
        m.put("messagesLastHour", jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM der.device_message "
          + "WHERE created_at > now() - interval '1 hour'", Integer.class));
        return m;
    }

    public List<Map<String, Object>> channelLeaderboard() {
        return jdbc.query(
            "SELECT channel, COUNT(*)::int AS n, MAX(created_at) AS last_at "
          + "  FROM der.device_message "
          + " WHERE created_at > now() - interval '24 hours' "
          + " GROUP BY channel ORDER BY n DESC LIMIT 20",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("channel", rs.getString("channel"));
                m.put("n", rs.getInt("n"));
                m.put("lastAt", rs.getTimestamp("last_at").toInstant().toString());
                return m;
            });
    }

    public List<Map<String, Object>> subscriptions() {
        return jdbc.query(
            "SELECT device_id, channel, cursor_at, last_poll_at, created_at "
          + "  FROM der.device_subscription ORDER BY last_poll_at DESC NULLS LAST LIMIT 200",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("deviceId", rs.getString("device_id"));
                m.put("channel",  rs.getString("channel"));
                m.put("cursorAt", optInstant(rs.getTimestamp("cursor_at")));
                m.put("lastPollAt", optInstant(rs.getTimestamp("last_poll_at")));
                m.put("createdAt",  optInstant(rs.getTimestamp("created_at")));
                return m;
            });
    }

    public void upsertSubscription(final String deviceId, final String channel) {
        jdbc.update(
            "INSERT INTO der.device_subscription (device_id, channel) "
          + "VALUES (?, ?) "
          + "ON CONFLICT (device_id, channel) DO NOTHING",
            deviceId, channel);
    }

    public int deleteSubscription(final String deviceId, final String channel) {
        return jdbc.update(
            "DELETE FROM der.device_subscription "
          + " WHERE device_id = ? AND channel = ?",
            deviceId, channel);
    }

    public List<String> channelsFor(final String deviceId) {
        return jdbc.query(
            "SELECT channel FROM der.device_subscription WHERE device_id = ?",
            (rs, row) -> rs.getString("channel"), deviceId);
    }

    public void updateCursor(final String deviceId, final String channel,
                               final Instant cursor) {
        jdbc.update(
            "UPDATE der.device_subscription "
          + "   SET cursor_at = GREATEST(COALESCE(cursor_at, ?), ?), "
          + "       last_poll_at = now() "
          + " WHERE device_id = ? AND channel = ?",
            Timestamp.from(cursor), Timestamp.from(cursor), deviceId, channel);
    }

    public int ack(final UUID messageId, final String deviceId) {
        return jdbc.update(
            "INSERT INTO der.device_message_ack (message_id, device_id) "
          + "VALUES (?, ?) ON CONFLICT DO NOTHING",
            messageId, deviceId);
    }

    public int deleteExpired() {
        return jdbc.update(
            "DELETE FROM der.device_message "
          + " WHERE expires_at IS NOT NULL AND expires_at < now()");
    }

    /* ─── Helpers ───────────────────────────────────────────────── */

    private static Map<String, Object> rowMap(final ResultSet rs) throws java.sql.SQLException {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("messageId",    rs.getObject("message_id").toString());
        m.put("channel",      rs.getString("channel"));
        m.put("fromDeviceId", rs.getString("from_device_id"));
        final Object fu = rs.getObject("from_user_id");
        m.put("fromUserId",   fu == null ? null : fu.toString());
        m.put("messageType",  rs.getString("message_type"));
        m.put("payload",      rs.getString("payload"));
        final Object rt = rs.getObject("reply_to");
        m.put("replyTo",      rt == null ? null : rt.toString());
        m.put("expiresAt",    optInstant(rs.getTimestamp("expires_at")));
        m.put("createdAt",    optInstant(rs.getTimestamp("created_at")));
        // v2 extensions. Row metadata may not be present on older
        // columns if an operator ran a mid-upgrade query — guard with
        // getObject + wasNull on the primitive.
        try {
            final boolean enc = rs.getBoolean("encrypted");
            m.put("encrypted", rs.wasNull() ? false : enc);
        } catch (final java.sql.SQLException ignore) {
            // older row shape
        }
        try {
            m.put("recipientDeviceId", rs.getString("recipient_device_id"));
        } catch (final java.sql.SQLException ignore) {
            // older row shape
        }
        try {
            m.put("senderEphemeralPubkey", rs.getString("sender_ephemeral_pubkey"));
        } catch (final java.sql.SQLException ignore) {
            // older row shape
        }
        try {
            m.put("nonce", rs.getString("nonce"));
        } catch (final java.sql.SQLException ignore) {
            // older row shape
        }
        return m;
    }

    private static String optInstant(final Timestamp ts) {
        return ts == null ? null : ts.toInstant().toString();
    }
}
