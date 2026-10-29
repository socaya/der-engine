package ug.ac.mak.der.messaging;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.network.NetworkCaService;
import ug.ac.mak.der.network.NetworkEntities.NetworkPeer;
import ug.ac.mak.der.network.NetworkEntities.PeerState;
import ug.ac.mak.der.network.NetworkEntities.PeerTrust;
import ug.ac.mak.der.network.NetworkRepository;

/** Phase N5 v2 — Edge-to-edge message forwarder.
 *
 *  <p>When a message is published to a channel prefixed
 *  {@code edge:<fingerprint>:<sub>} we relay it to that peer edge
 *  over its WireGuard HTTPS tunnel. The receiver stores the message
 *  on its own bus and dispatches to local subscribers of
 *  {@code <sub>}.</p>
 *
 *  <p>Forwarding is best-effort — the DER-SYNC v2 story is "the
 *  receiver takes care of retry via its own cursor-based catch-up".
 *  For now we just try once and log the outcome.</p>
 */
@Component
public class EdgeMessageForwarder {

    private static final Logger LOG = LoggerFactory.getLogger(EdgeMessageForwarder.class);
    private static final String EDGE_PREFIX = "edge:";

    private final NetworkRepository networkRepo;
    private final NetworkCaService ca;
    private final MessagingV2Repository v2repo;
    private final ObjectMapper mapper;
    private final HttpClient http;

    public EdgeMessageForwarder(final NetworkRepository networkRepo,
                                  final NetworkCaService ca,
                                  final MessagingV2Repository v2repo,
                                  final ObjectMapper mapper) {
        this.networkRepo = Objects.requireNonNull(networkRepo, "networkRepo");
        this.ca = Objects.requireNonNull(ca, "ca");
        this.v2repo = Objects.requireNonNull(v2repo, "v2repo");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.http = HttpClient.newBuilder()
                              .connectTimeout(Duration.ofSeconds(5))
                              .build();
    }

    /** Returns null if the channel isn't an edge: channel. Otherwise
     *  returns the target edge fingerprint parsed from the channel. */
    public static String targetEdgeId(final String channel) {
        if (channel == null || !channel.startsWith(EDGE_PREFIX)) {
            return null;
        }
        final int sep = channel.indexOf(':', EDGE_PREFIX.length());
        if (sep < 0) {
            return channel.substring(EDGE_PREFIX.length());
        }
        return channel.substring(EDGE_PREFIX.length(), sep);
    }

    /** Returns the "subchannel" portion after the fingerprint. */
    public static String subChannel(final String channel) {
        if (channel == null || !channel.startsWith(EDGE_PREFIX)) {
            return null;
        }
        final int sep = channel.indexOf(':', EDGE_PREFIX.length());
        if (sep < 0 || sep + 1 >= channel.length()) {
            return "broadcast";
        }
        return channel.substring(sep + 1);
    }

    @Async
    public void forward(final UUID messageId, final String channel,
                          final Map<String, Object> originalMessage) {
        final String targetEdge = targetEdgeId(channel);
        if (targetEdge == null) {
            return;
        }
        if (targetEdge.equals(ca.fingerprint())) {
            LOG.debug("ignoring self-forward for {}", messageId);
            return;
        }
        // Find a TRUSTED + CONNECTED peer whose nodeId matches the
        // target edge fingerprint; nodeId is operator-set at add-peer
        // time so operators can match arbitrary identifiers.
        NetworkPeer target = null;
        for (final NetworkPeer p : networkRepo.listPeers()) {
            if (targetEdge.equals(p.nodeId())
                    && p.state() == PeerState.CONNECTED
                    && p.trust() == PeerTrust.TRUSTED) {
                target = p;
                break;
            }
        }
        if (target == null) {
            v2repo.recordForward(messageId, targetEdge, null, "NO_PEER", null,
                                  "no TRUSTED+CONNECTED peer with nodeId=" + targetEdge);
            return;
        }
        final String sub = subChannel(channel);
        final Map<String, Object> relayed = new java.util.LinkedHashMap<>(originalMessage);
        // Rewrite channel to the sub-channel so the receiver sees it on
        // its own bus (not another edge: channel to re-forward forever).
        relayed.put("channel", sub);
        relayed.put("relayedFromEdgeId", ca.fingerprint());
        final String host = target.endpoint().split(":")[0];
        final URI uri = URI.create("https://" + host + ":8443/edge-api/v1/messaging/relay");
        try {
            final HttpResponse<String> r = http.send(
                HttpRequest.newBuilder(uri)
                           .timeout(Duration.ofSeconds(10))
                           .header("Content-Type", "application/json")
                           .POST(HttpRequest.BodyPublishers.ofString(
                               mapper.writeValueAsString(List.of(relayed))))
                           .build(),
                HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() >= 200 && r.statusCode() < 300) {
                v2repo.recordForward(messageId, targetEdge, target.id(),
                                      "SUCCESS", r.statusCode(), null);
            } else {
                v2repo.recordForward(messageId, targetEdge, target.id(),
                                      "HTTP_ERROR", r.statusCode(),
                                      r.body().length() > 200 ? r.body().substring(0, 200) : r.body());
            }
        } catch (final Exception ex) {
            v2repo.recordForward(messageId, targetEdge, target.id(),
                                  "PEER_UNREACHABLE", null,
                                  ex.getMessage() == null ? ex.getClass().getSimpleName()
                                                           : ex.getMessage());
        }
    }

    public List<Map<String, Object>> recentForwards(final int limit) {
        return v2repo.recentForwards(limit);
    }
}
