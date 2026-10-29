package ug.ac.mak.der.messaging;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** §1 WebRTC signalling broker — devices exchange SDP + ICE through
 *  DER, then stream data channels / audio / video peer-to-peer. DER
 *  never sees media; only the handshake metadata. */
@Service
public class WebRtcSignallingService {

    private final JdbcTemplate jdbc;

    public WebRtcSignallingService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Transactional
    public UUID offer(final String initiatorDevice, final String responderDevice,
                        final String sdpOffer, final String kind) {
        final UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO der.webrtc_session "
          + "(session_id, initiator_device, responder_device, sdp_offer, kind) "
          + "VALUES (?, ?, ?, ?, ?)",
            id, initiatorDevice, responderDevice, sdpOffer,
            kind == null ? "data" : kind);
        return id;
    }

    @Transactional
    public boolean answer(final UUID sessionId, final String sdpAnswer) {
        return jdbc.update(
            "UPDATE der.webrtc_session "
          + "   SET sdp_answer = ?, state = 'ANSWERED' "
          + " WHERE session_id = ? AND state = 'OFFERED'",
            sdpAnswer, sessionId) > 0;
    }

    @Transactional
    public boolean complete(final UUID sessionId) {
        return jdbc.update(
            "UPDATE der.webrtc_session "
          + "   SET state = 'COMPLETED', completed_at = now() "
          + " WHERE session_id = ? AND state = 'ANSWERED'",
            sessionId) > 0;
    }

    public Optional<Map<String, Object>> findSession(final UUID sessionId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                "SELECT session_id, initiator_device, responder_device, "
              + "       sdp_offer, sdp_answer, state, created_at, "
              + "       completed_at, kind "
              + "  FROM der.webrtc_session WHERE session_id = ?",
                (rs, row) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("sessionId", rs.getObject("session_id").toString());
                    m.put("initiatorDevice", rs.getString("initiator_device"));
                    m.put("responderDevice", rs.getString("responder_device"));
                    m.put("sdpOffer",  rs.getString("sdp_offer"));
                    m.put("sdpAnswer", rs.getString("sdp_answer"));
                    m.put("state",     rs.getString("state"));
                    m.put("kind",      rs.getString("kind"));
                    m.put("createdAt", rs.getTimestamp("created_at").toInstant().toString());
                    final Timestamp ct = rs.getTimestamp("completed_at");
                    m.put("completedAt", ct == null ? null : ct.toInstant().toString());
                    return m;
                }, sessionId));
        } catch (final org.springframework.dao.EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<Map<String, Object>> pendingFor(final String deviceId) {
        return jdbc.query(
            "SELECT session_id, initiator_device, kind, sdp_offer, created_at "
          + "  FROM der.webrtc_session "
          + " WHERE responder_device = ? AND state = 'OFFERED' "
          + " ORDER BY created_at ASC LIMIT 20",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("sessionId",       rs.getObject("session_id").toString());
                m.put("initiatorDevice", rs.getString("initiator_device"));
                m.put("kind",            rs.getString("kind"));
                m.put("sdpOffer",        rs.getString("sdp_offer"));
                m.put("createdAt",       rs.getTimestamp("created_at").toInstant().toString());
                return m;
            }, deviceId);
    }

    public List<Map<String, Object>> recentSessions(final int limit) {
        return jdbc.query(
            "SELECT session_id, initiator_device, responder_device, "
          + "       state, kind, created_at, completed_at "
          + "  FROM der.webrtc_session "
          + " ORDER BY created_at DESC LIMIT ?",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("sessionId",       rs.getObject("session_id").toString());
                m.put("initiatorDevice", rs.getString("initiator_device"));
                m.put("responderDevice", rs.getString("responder_device"));
                m.put("state",           rs.getString("state"));
                m.put("kind",            rs.getString("kind"));
                m.put("createdAt",       rs.getTimestamp("created_at").toInstant().toString());
                final Timestamp ct = rs.getTimestamp("completed_at");
                m.put("completedAt",     ct == null ? null : ct.toInstant().toString());
                return m;
            }, Math.max(1, Math.min(limit, 100)));
    }

    @Transactional
    public long addIceCandidate(final UUID sessionId, final String fromDevice,
                                  final String candidateSdp, final String sdpMid,
                                  final Integer sdpMLineIndex) {
        final Number nextId = jdbc.queryForObject(
            "INSERT INTO der.webrtc_ice_candidate "
          + "(session_id, from_device, candidate_sdp, sdp_mid, sdp_m_line_index) "
          + "VALUES (?, ?, ?, ?, ?) RETURNING candidate_id",
            Number.class, sessionId, fromDevice, candidateSdp, sdpMid, sdpMLineIndex);
        return nextId == null ? 0 : nextId.longValue();
    }

    public List<Map<String, Object>> iceCandidatesFor(final UUID sessionId,
                                                        final String excludeFromDevice,
                                                        final long sinceId) {
        return jdbc.query(
            "SELECT candidate_id, from_device, candidate_sdp, sdp_mid, "
          + "       sdp_m_line_index, created_at "
          + "  FROM der.webrtc_ice_candidate "
          + " WHERE session_id = ? "
          + "   AND from_device <> ? "
          + "   AND candidate_id > ? "
          + " ORDER BY candidate_id ASC LIMIT 50",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("candidateId",     rs.getLong("candidate_id"));
                m.put("fromDevice",      rs.getString("from_device"));
                m.put("candidate",       rs.getString("candidate_sdp"));
                m.put("sdpMid",          rs.getString("sdp_mid"));
                m.put("sdpMLineIndex",   rs.getObject("sdp_m_line_index"));
                m.put("createdAt",       rs.getTimestamp("created_at").toInstant().toString());
                return m;
            },
            sessionId, excludeFromDevice == null ? "" : excludeFromDevice, sinceId);
    }
}
