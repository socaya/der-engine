package ug.ac.mak.der.network;

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

/** Phase N5 production — discovery, invites, health, retry. */
@Repository
public class PeerLifecycleRepository {

    private final JdbcTemplate jdbc;

    public PeerLifecycleRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /* ─── mDNS discovery ───────────────────────────────────────── */

    public void upsertDiscovered(final String nodeId, final String hostname,
                                   final String endpoint, final String serviceType,
                                   final String version, final String edgeFingerprint) {
        jdbc.update(
            "INSERT INTO der.peer_discovered "
          + "(node_id, hostname, endpoint, service_type, announced_version, "
          + " announced_edge_fingerprint) "
          + "VALUES (?, ?, ?, ?, ?, ?) "
          + "ON CONFLICT (node_id, endpoint) DO UPDATE SET "
          + "  last_seen_at = now(), "
          + "  hostname = EXCLUDED.hostname, "
          + "  announced_version = COALESCE(EXCLUDED.announced_version, "
          + "                                der.peer_discovered.announced_version), "
          + "  announced_edge_fingerprint = COALESCE(EXCLUDED.announced_edge_fingerprint, "
          + "                                        der.peer_discovered.announced_edge_fingerprint)",
            nodeId, hostname, endpoint, serviceType, version, edgeFingerprint);
    }

    public List<Map<String, Object>> listDiscovered() {
        return jdbc.query(
            "SELECT discovered_id, node_id, hostname, endpoint, service_type, "
          + "       announced_version, announced_edge_fingerprint, "
          + "       first_seen_at, last_seen_at, reviewed, approved_peer_id "
          + "  FROM der.peer_discovered ORDER BY last_seen_at DESC",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("discoveredId", rs.getObject("discovered_id").toString());
                m.put("nodeId", rs.getString("node_id"));
                m.put("hostname", rs.getString("hostname"));
                m.put("endpoint", rs.getString("endpoint"));
                m.put("serviceType", rs.getString("service_type"));
                m.put("announcedVersion", rs.getString("announced_version"));
                m.put("announcedEdgeFingerprint", rs.getString("announced_edge_fingerprint"));
                m.put("firstSeenAt", rs.getTimestamp("first_seen_at").toInstant().toString());
                m.put("lastSeenAt",  rs.getTimestamp("last_seen_at").toInstant().toString());
                m.put("reviewed", rs.getBoolean("reviewed"));
                final Object ap = rs.getObject("approved_peer_id");
                m.put("approvedPeerId", ap == null ? null : ap.toString());
                return m;
            });
    }

    public int markReviewed(final UUID discoveredId, final UUID approvedPeerId) {
        return jdbc.update(
            "UPDATE der.peer_discovered "
          + "   SET reviewed = TRUE, approved_peer_id = ? "
          + " WHERE discovered_id = ?",
            approvedPeerId, discoveredId);
    }

    /* ─── Peer invite tokens ───────────────────────────────────── */

    public void insertInvite(final String tokenHash, final UUID issuedBy,
                               final Instant expiresAt, final String note) {
        jdbc.update(
            "INSERT INTO der.peer_invite_token "
          + "(token_hash, issued_by, expires_at, note) VALUES (?, ?, ?, ?)",
            tokenHash, issuedBy, Timestamp.from(expiresAt), note);
    }

    public boolean consumeInvite(final String tokenHash, final String consumingEdge,
                                   final UUID peerId) {
        return jdbc.update(
            "UPDATE der.peer_invite_token "
          + "   SET consumed_at = now(), consumed_by_edge = ?, consumed_by_peer_id = ? "
          + " WHERE token_hash = ? AND consumed_at IS NULL "
          + "   AND expires_at > now()",
            consumingEdge, peerId, tokenHash) > 0;
    }

    public List<Map<String, Object>> listInvites() {
        return jdbc.query(
            "SELECT token_hash, issued_at, expires_at, note, "
          + "       consumed_at, consumed_by_edge "
          + "  FROM der.peer_invite_token "
          + "  ORDER BY issued_at DESC LIMIT 50",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("tokenHash", rs.getString("token_hash"));
                m.put("issuedAt", rs.getTimestamp("issued_at").toInstant().toString());
                m.put("expiresAt", rs.getTimestamp("expires_at").toInstant().toString());
                m.put("note", rs.getString("note"));
                final Timestamp cs = rs.getTimestamp("consumed_at");
                m.put("consumedAt", cs == null ? null : cs.toInstant().toString());
                m.put("consumedByEdge", rs.getString("consumed_by_edge"));
                return m;
            });
    }

    /* ─── Peer health samples ──────────────────────────────────── */

    public void recordSample(final UUID peerId, final String outcome,
                               final Integer latencyMs, final String remoteVersion,
                               final Long remoteUptimeS, final Integer httpStatus,
                               final String reason) {
        jdbc.update(
            "INSERT INTO der.peer_health_sample "
          + "(peer_id, outcome, latency_ms, remote_version, "
          + " remote_uptime_s, http_status, reason) "
          + "VALUES (?, ?, ?, ?, ?, ?, ?)",
            peerId, outcome, latencyMs, remoteVersion,
            remoteUptimeS, httpStatus, reason);
    }

    public Map<String, Object> healthSummary(final UUID peerId) {
        try {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("peerId", peerId.toString());
            final Integer samples = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM der.peer_health_sample "
              + " WHERE peer_id = ? AND sampled_at > now() - interval '24 hours'",
                Integer.class, peerId);
            m.put("samples24h", samples);
            final Integer up = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM der.peer_health_sample "
              + " WHERE peer_id = ? AND sampled_at > now() - interval '24 hours' "
              + "   AND outcome = 'UP'",
                Integer.class, peerId);
            m.put("up24h", up);
            m.put("uptime24h", samples == 0 ? null
                               : Math.round(100.0 * up / samples));
            final Timestamp last = jdbc.queryForObject(
                "SELECT MAX(sampled_at) FROM der.peer_health_sample WHERE peer_id = ?",
                Timestamp.class, peerId);
            m.put("lastSampledAt", last == null ? null : last.toInstant().toString());
            return m;
        } catch (final Exception ex) {
            return Map.of("peerId", peerId.toString(), "samples24h", 0);
        }
    }

    /* ─── Forward retry queue ──────────────────────────────────── */

    public void scheduleRetry(final UUID messageId, final String targetEdgeId,
                                 final Instant nextAt) {
        jdbc.update(
            "INSERT INTO der.forward_retry "
          + "(message_id, target_edge_id, next_attempt_at) "
          + "VALUES (?, ?, ?) "
          + "ON CONFLICT (retry_id) DO NOTHING",
            messageId, targetEdgeId, Timestamp.from(nextAt));
    }

    public List<Map<String, Object>> dueRetries(final int limit) {
        return jdbc.query(
            "SELECT retry_id, message_id, target_edge_id, attempt_count, "
          + "       next_attempt_at, last_attempt_at, last_outcome, last_reason, "
          + "       give_up_after "
          + "  FROM der.forward_retry "
          + " WHERE attempt_count < give_up_after "
          + "   AND next_attempt_at <= now() "
          + " ORDER BY next_attempt_at ASC LIMIT ?",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("retryId", rs.getObject("retry_id").toString());
                m.put("messageId", rs.getObject("message_id").toString());
                m.put("targetEdgeId", rs.getString("target_edge_id"));
                m.put("attemptCount", rs.getInt("attempt_count"));
                m.put("giveUpAfter",  rs.getInt("give_up_after"));
                return m;
            }, Math.max(1, Math.min(limit, 50)));
    }

    public void markRetryAttempt(final UUID retryId, final String outcome,
                                   final String reason, final Instant nextAt,
                                   final boolean exhausted) {
        if (exhausted) {
            jdbc.update(
                "UPDATE der.forward_retry "
              + "   SET attempt_count = give_up_after, "
              + "       last_attempt_at = now(), "
              + "       last_outcome = ?, last_reason = ? "
              + " WHERE retry_id = ?",
                outcome, reason, retryId);
            return;
        }
        jdbc.update(
            "UPDATE der.forward_retry "
          + "   SET attempt_count = attempt_count + 1, "
          + "       last_attempt_at = now(), "
          + "       next_attempt_at = ?, "
          + "       last_outcome = ?, last_reason = ? "
          + " WHERE retry_id = ?",
            Timestamp.from(nextAt), outcome, reason, retryId);
    }

    public void deleteSettled(final UUID retryId) {
        jdbc.update("DELETE FROM der.forward_retry WHERE retry_id = ?", retryId);
    }

    public List<Map<String, Object>> retryQueueSnapshot() {
        return jdbc.query(
            "SELECT retry_id, message_id, target_edge_id, attempt_count, "
          + "       next_attempt_at, last_attempt_at, last_outcome, last_reason, "
          + "       give_up_after "
          + "  FROM der.forward_retry "
          + "  ORDER BY next_attempt_at ASC LIMIT 50",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("retryId", rs.getObject("retry_id").toString());
                m.put("messageId", rs.getObject("message_id").toString());
                m.put("targetEdgeId", rs.getString("target_edge_id"));
                m.put("attemptCount", rs.getInt("attempt_count"));
                m.put("nextAttemptAt", rs.getTimestamp("next_attempt_at").toInstant().toString());
                final Timestamp la = rs.getTimestamp("last_attempt_at");
                m.put("lastAttemptAt", la == null ? null : la.toInstant().toString());
                m.put("lastOutcome", rs.getString("last_outcome"));
                m.put("lastReason", rs.getString("last_reason"));
                m.put("giveUpAfter", rs.getInt("give_up_after"));
                return m;
            });
    }
}
