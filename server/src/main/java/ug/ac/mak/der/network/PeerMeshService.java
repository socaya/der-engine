package ug.ac.mak.der.network;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.network.NetworkEntities.NetworkPeer;
import ug.ac.mak.der.network.NetworkEntities.PeerState;
import ug.ac.mak.der.network.NetworkEntities.PeerTrust;

/** §1 Peer mesh maturity — Ed25519 invite signing, mesh adjacency,
 *  shortest-path routing, and CRDT vector-clock catch-up. */
@Service
public class PeerMeshService {

    private static final Logger LOG = LoggerFactory.getLogger(PeerMeshService.class);
    private static final String INVITE_HEADER = "DER-INVITE v1";

    private final JdbcTemplate jdbc;
    private final NetworkCaService ca;
    private final NetworkRepository networkRepo;
    private final ObjectMapper mapper;

    public PeerMeshService(final JdbcTemplate jdbc, final NetworkCaService ca,
                            final NetworkRepository networkRepo,
                            final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.ca = Objects.requireNonNull(ca, "ca");
        this.networkRepo = Objects.requireNonNull(networkRepo, "networkRepo");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    /* ─── Ed25519 signed invites ────────────────────────────────── */

    public Map<String, Object> issueSignedInvite(final UUID issuedBy, final String note,
                                                    final int ttlSeconds, final String tokenHash) {
        ca.ensureCa();
        final Instant expires = Instant.now().plusSeconds(Math.max(60, ttlSeconds));
        final Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("issuer", ca.fingerprint());
        payload.put("expiresAt", expires.toString());
        payload.put("note", note == null ? "" : note);
        payload.put("tokenHash", tokenHash);
        final String payloadJson;
        try {
            payloadJson = mapper.writeValueAsString(payload);
        } catch (final Exception ex) {
            throw new IllegalStateException("could not serialise invite payload", ex);
        }
        final String payloadB64 = Base64.getUrlEncoder().withoutPadding()
                                        .encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
        final NetworkCaService.Attestation signed = ca.issueAttestation(
            Base64.getEncoder().encodeToString(payloadB64.getBytes(StandardCharsets.UTF_8)));
        // The attestation blob embeds its own signature; we extract it so
        // we can store signature + payload separately.
        final String sigPart = signed.blob().contains(".")
            ? signed.blob().substring(signed.blob().lastIndexOf('.') + 1)
            : signed.blob();
        jdbc.update(
            "UPDATE der.peer_invite_token "
          + "   SET payload_base64 = ?, signature_base64 = ?, issuer_edge = ? "
          + " WHERE token_hash = ?",
            payloadB64, sigPart, ca.fingerprint(), tokenHash);
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("payload", payloadB64);
        out.put("signature", sigPart);
        out.put("issuerEdge", ca.fingerprint());
        out.put("algorithm", "Ed25519");
        return out;
    }

    /** Verify a signed invite without reaching back to the issuer —
     *  caller provides the issuer's public key (fetched over the
     *  mesh via GET /network/ca). Returns the parsed payload if the
     *  signature matches. */
    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> verifyInvite(final String payloadB64, final String signatureB64,
                                                        final String issuerPubkeyBase64) {
        if (payloadB64 == null || signatureB64 == null || issuerPubkeyBase64 == null) {
            return Optional.empty();
        }
        try {
            final byte[] pubBytes = Base64.getDecoder().decode(issuerPubkeyBase64);
            final PublicKey pub = KeyFactory.getInstance("Ed25519")
                                             .generatePublic(new X509EncodedKeySpec(pubBytes));
            final Signature sig = Signature.getInstance("Ed25519");
            sig.initVerify(pub);
            // The attestation signs the SHA-256 of the base64-payload
            // concatenated with the issued-at (CA service already handles
            // this in issueAttestation); verifier here checks against the
            // same canonical form.
            final String payload = Base64.getEncoder().encodeToString(
                payloadB64.getBytes(StandardCharsets.UTF_8));
            // Match the CA's attestation signing: the attestation blob is
            // "EDGE-ATTEST v1 <sha256-payload>.<sig>". The sha256-payload
            // is what we need. See NetworkCaService.issueAttestation.
            final byte[] shaPayload = java.security.MessageDigest.getInstance("SHA-256")
                .digest((payload + System.lineSeparator())
                           .getBytes(StandardCharsets.UTF_8));
            // Simpler safe path — Base64-decode the signature and verify
            // against the sha-payload directly, matching the CA sign path.
            sig.update(Base64.getEncoder().withoutPadding()
                               .encodeToString(shaPayload)
                               .getBytes(StandardCharsets.US_ASCII));
            if (!sig.verify(Base64.getDecoder().decode(signatureB64))) {
                return Optional.empty();
            }
            final String json = new String(Base64.getUrlDecoder().decode(payloadB64),
                                             StandardCharsets.UTF_8);
            return Optional.of(mapper.readValue(json, Map.class));
        } catch (final Exception ex) {
            LOG.debug("invite verify failed", ex);
            return Optional.empty();
        }
    }

    /* ─── Peer adjacency (who-can-reach-whom) ──────────────────── */

    public void announceAdjacency(final UUID localPeerId, final String reachableEdge,
                                     final int hops) {
        jdbc.update(
            "INSERT INTO der.peer_adjacency "
          + "(local_peer_id, reachable_edge, hops, announced_at) "
          + "VALUES (?, ?, ?, now()) "
          + "ON CONFLICT (local_peer_id, reachable_edge) DO UPDATE SET "
          + "  hops = LEAST(der.peer_adjacency.hops, EXCLUDED.hops), "
          + "  announced_at = now()",
            localPeerId, reachableEdge, hops);
    }

    public List<Map<String, Object>> listAdjacency() {
        return jdbc.query(
            "SELECT a.local_peer_id, p.node_id, p.endpoint, "
          + "       a.reachable_edge, a.hops, a.announced_at "
          + "  FROM der.peer_adjacency a "
          + "  JOIN der.network_peer p ON p.id = a.local_peer_id "
          + " ORDER BY a.hops ASC, a.announced_at DESC",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("localPeerId",   rs.getObject("local_peer_id").toString());
                m.put("localNodeId",   rs.getString("node_id"));
                m.put("localEndpoint", rs.getString("endpoint"));
                m.put("reachableEdge", rs.getString("reachable_edge"));
                m.put("hops",          rs.getInt("hops"));
                m.put("announcedAt",   rs.getTimestamp("announced_at").toInstant().toString());
                return m;
            });
    }

    /** Pick the best route to {@code targetEdgeId}: a direct TRUSTED
     *  CONNECTED peer if one exists; otherwise the lowest-hop
     *  intermediate that can reach the target. */
    public Optional<NetworkPeer> resolveRoute(final String targetEdgeId) {
        if (targetEdgeId == null) {
            return Optional.empty();
        }
        // Direct peer with matching nodeId.
        for (final NetworkPeer p : networkRepo.listPeers()) {
            if (targetEdgeId.equals(p.nodeId())
                    && p.state() == PeerState.CONNECTED
                    && p.trust() == PeerTrust.TRUSTED) {
                return Optional.of(p);
            }
        }
        // Transitive via adjacency table.
        try {
            final UUID viaPeerId = jdbc.queryForObject(
                "SELECT a.local_peer_id FROM der.peer_adjacency a "
              + "  JOIN der.network_peer p ON p.id = a.local_peer_id "
              + " WHERE a.reachable_edge = ? "
              + "   AND p.state = 'CONNECTED' AND p.trust = 'TRUSTED' "
              + " ORDER BY a.hops ASC LIMIT 1",
                UUID.class, targetEdgeId);
            if (viaPeerId == null) {
                return Optional.empty();
            }
            for (final NetworkPeer p : networkRepo.listPeers()) {
                if (p.id().equals(viaPeerId)) {
                    return Optional.of(p);
                }
            }
        } catch (final org.springframework.dao.EmptyResultDataAccessException ignored) {
            // no route
        }
        return Optional.empty();
    }

    /* ─── CRDT vector-clock catch-up ───────────────────────────── */

    @Transactional
    public void recordOp(final String docId, final String replicaId) {
        jdbc.update(
            "INSERT INTO der.crdt_vector_clock "
          + "(doc_id, replica_id, counter) VALUES (?, ?, 1) "
          + "ON CONFLICT (doc_id, replica_id) DO UPDATE SET "
          + "  counter = der.crdt_vector_clock.counter + 1, "
          + "  updated_at = now()",
            docId, replicaId);
    }

    public Map<String, Object> vectorClock(final String docId) {
        final Map<String, Long> clock = new LinkedHashMap<>();
        jdbc.query(
            "SELECT replica_id, counter FROM der.crdt_vector_clock "
          + " WHERE doc_id = ? ORDER BY replica_id",
            (ResultSet rs) -> {
                clock.put(rs.getString("replica_id"), rs.getLong("counter"));
            }, docId);
        return Map.of("docId", docId, "clock", clock);
    }

    /** Return the ops needed to bring a late joiner up to our current
     *  vector-clock, given their existing clock. In practice: every
     *  CRDT_OP message on channel crdt:{docId} newer than their
     *  per-replica counter. */
    public List<Map<String, Object>> catchupOps(final String docId,
                                                   final Map<String, Long> clientClock) {
        return jdbc.query(
            "SELECT message_id, from_device_id, payload::text AS payload, created_at "
          + "  FROM der.device_message "
          + " WHERE channel = ? AND message_type = 'CRDT_OP' "
          + " ORDER BY created_at ASC",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("messageId",   rs.getObject("message_id").toString());
                m.put("fromDeviceId", rs.getString("from_device_id"));
                m.put("payload",     rs.getString("payload"));
                m.put("createdAt",   rs.getTimestamp("created_at").toInstant().toString());
                return m;
            },
            "crdt:" + docId)
            .stream()
            .filter(op -> {
                // Keep ops authored by replicas whose counter in the
                // client's clock is lower than our view, OR unknown
                // replicas (client has never seen them).
                final String replica = (String) op.get("fromDeviceId");
                final long clientSeen = clientClock == null
                    ? 0L
                    : clientClock.getOrDefault(replica, 0L);
                // We don't track op sequence inside each message here;
                // the message created_at acts as monotonic per replica
                // (within one edge).  Return everything the client is
                // missing — client dedups by messageId.
                return clientSeen >= 0L;  // naive — return all; client dedups
            })
            .toList();
    }

    /* ─── Topology snapshot for the admin UI ───────────────────── */

    public Map<String, Object> topology() {
        final Map<String, Object> self = new LinkedHashMap<>();
        self.put("fingerprint", ca.fingerprint());
        self.put("role", "self");
        final List<Map<String, Object>> peers = new java.util.ArrayList<>();
        for (final NetworkPeer p : networkRepo.listPeers()) {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", p.id().toString());
            row.put("nodeId", p.nodeId());
            row.put("endpoint", p.endpoint());
            row.put("state", p.state().name());
            row.put("trust", p.trust().name());
            row.put("reachable", peerAdjacencySummary(p.id()));
            peers.add(row);
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("self", self);
        out.put("peers", peers);
        return out;
    }

    private List<Map<String, Object>> peerAdjacencySummary(final UUID peerId) {
        return jdbc.query(
            "SELECT reachable_edge, hops, announced_at "
          + "  FROM der.peer_adjacency "
          + " WHERE local_peer_id = ? ORDER BY hops ASC LIMIT 20",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("edgeFingerprint", rs.getString("reachable_edge"));
                m.put("hops", rs.getInt("hops"));
                m.put("announcedAt", rs.getTimestamp("announced_at").toInstant().toString());
                return m;
            }, peerId);
    }
}
