package ug.ac.mak.der.messaging;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Phase N5 v2 — device-key registry, CRDT doc index, and
 *  edge-forwarding audit log. One class because each table is small
 *  and lives in the messaging bounded context. */
@Repository
public class MessagingV2Repository {

    private final JdbcTemplate jdbc;

    public MessagingV2Repository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /* ─── Device keys (X25519 + Ed25519) ────────────────────────── */

    public void upsertKeys(final String deviceId, final String x25519,
                             final String ed25519) {
        jdbc.update(
            "INSERT INTO der.device_crypto_key "
          + "(device_id, x25519_public_key_base64, ed25519_public_key_base64) "
          + "VALUES (?, ?, ?) "
          + "ON CONFLICT (device_id) DO UPDATE SET "
          + "  x25519_public_key_base64 = EXCLUDED.x25519_public_key_base64, "
          + "  ed25519_public_key_base64 = COALESCE("
          + "    EXCLUDED.ed25519_public_key_base64, "
          + "    der.device_crypto_key.ed25519_public_key_base64), "
          + "  updated_at = now()",
            deviceId, x25519, ed25519);
    }

    public Optional<Map<String, Object>> findKeys(final String deviceId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                "SELECT device_id, x25519_public_key_base64, "
              + "       ed25519_public_key_base64, updated_at "
              + "  FROM der.device_crypto_key WHERE device_id = ?",
                this::mapKey, deviceId));
        } catch (final EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<Map<String, Object>> listKeys() {
        return jdbc.query(
            "SELECT device_id, x25519_public_key_base64, "
          + "       ed25519_public_key_base64, updated_at "
          + "  FROM der.device_crypto_key ORDER BY updated_at DESC",
            this::mapKey);
    }

    private Map<String, Object> mapKey(final ResultSet rs, final int row) throws java.sql.SQLException {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("deviceId", rs.getString("device_id"));
        m.put("x25519PublicKeyBase64",  rs.getString("x25519_public_key_base64"));
        m.put("ed25519PublicKeyBase64", rs.getString("ed25519_public_key_base64"));
        m.put("updatedAt", rs.getTimestamp("updated_at").toInstant().toString());
        return m;
    }

    /* ─── CRDT documents ───────────────────────────────────────── */

    public void upsertDocument(final String docId, final String docType,
                                 final String createdBy, final String description) {
        jdbc.update(
            "INSERT INTO der.crdt_document (doc_id, doc_type, created_by, description) "
          + "VALUES (?, ?, ?, ?) "
          + "ON CONFLICT (doc_id) DO NOTHING",
            docId, docType, createdBy, description);
    }

    public int recordOp(final String docId) {
        return jdbc.update(
            "UPDATE der.crdt_document "
          + "   SET last_op_at = now(), op_count = op_count + 1 "
          + " WHERE doc_id = ?", docId);
    }

    public List<Map<String, Object>> listDocuments() {
        return jdbc.query(
            "SELECT doc_id, doc_type, created_by, description, "
          + "       created_at, last_op_at, op_count "
          + "  FROM der.crdt_document "
          + " ORDER BY last_op_at DESC NULLS LAST",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("docId",       rs.getString("doc_id"));
                m.put("docType",     rs.getString("doc_type"));
                m.put("createdBy",   rs.getString("created_by"));
                m.put("description", rs.getString("description"));
                m.put("createdAt",   rs.getTimestamp("created_at").toInstant().toString());
                final Timestamp lo = rs.getTimestamp("last_op_at");
                m.put("lastOpAt",    lo == null ? null : lo.toInstant().toString());
                m.put("opCount",     rs.getLong("op_count"));
                return m;
            });
    }

    /* ─── Edge forwarding audit ────────────────────────────────── */

    public void recordForward(final UUID messageId, final String targetEdgeId,
                                final UUID targetPeerId, final String outcome,
                                final Integer httpStatus, final String reason) {
        jdbc.update(
            "INSERT INTO der.message_forward_log "
          + "(message_id, target_edge_id, target_peer_id, outcome, http_status, reason) "
          + "VALUES (?, ?, ?, ?, ?, ?)",
            messageId, targetEdgeId, targetPeerId, outcome, httpStatus, reason);
    }

    public List<Map<String, Object>> recentForwards(final int limit) {
        return jdbc.query(
            "SELECT forward_id, message_id, target_edge_id, target_peer_id, "
          + "       outcome, http_status, attempted_at, reason "
          + "  FROM der.message_forward_log "
          + " ORDER BY attempted_at DESC LIMIT ?",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("forwardId",   rs.getObject("forward_id").toString());
                m.put("messageId",   rs.getObject("message_id").toString());
                m.put("targetEdgeId", rs.getString("target_edge_id"));
                final Object tp = rs.getObject("target_peer_id");
                m.put("targetPeerId", tp == null ? null : tp.toString());
                m.put("outcome", rs.getString("outcome"));
                final int hs = rs.getInt("http_status");
                m.put("httpStatus", rs.wasNull() ? null : hs);
                m.put("attemptedAt", rs.getTimestamp("attempted_at").toInstant().toString());
                m.put("reason", rs.getString("reason"));
                return m;
            },
            Math.max(1, Math.min(limit, 200)));
    }
}
