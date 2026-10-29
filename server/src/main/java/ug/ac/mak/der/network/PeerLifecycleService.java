package ug.ac.mak.der.network;

import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import javax.jmdns.JmDNS;
import javax.jmdns.ServiceEvent;
import javax.jmdns.ServiceInfo;
import javax.jmdns.ServiceListener;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.network.NetworkEntities.NetworkPeer;

/** Phase N5 production — peer discovery (mDNS), invite tokens,
 *  health monitoring, and exponential-backoff retry. */
@Service
public class PeerLifecycleService implements ServiceListener {

    private static final Logger LOG = LoggerFactory.getLogger(PeerLifecycleService.class);
    private static final String PEER_SERVICE_TYPE = "_der-peer._tcp.local.";

    private final PeerLifecycleRepository repo;
    private final NetworkRepository networkRepo;
    private final NetworkCaService ca;
    private final ObjectMapper mapper;
    private final HttpClient http;

    @Value("${der.https.port:8443}")
    private int httpsPort;

    @Value("${der.network.peer.discovery.enabled:true}")
    private boolean discoveryEnabled;

    private volatile JmDNS mdns;
    private final AtomicBoolean started = new AtomicBoolean(false);

    public PeerLifecycleService(final PeerLifecycleRepository repo,
                                   final NetworkRepository networkRepo,
                                   final NetworkCaService ca,
                                   final ObjectMapper mapper) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.networkRepo = Objects.requireNonNull(networkRepo, "networkRepo");
        this.ca = Objects.requireNonNull(ca, "ca");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.http = HttpClient.newBuilder()
                              .connectTimeout(Duration.ofSeconds(3))
                              .build();
    }

    /* ─── mDNS discovery ───────────────────────────────────────── */

    @PostConstruct
    public void startDiscovery() {
        if (!discoveryEnabled) {
            return;
        }
        try {
            ca.ensureCa();
            mdns = JmDNS.create(InetAddress.getLocalHost());
            final ServiceInfo info = ServiceInfo.create(
                PEER_SERVICE_TYPE,
                ca.fingerprint().substring(0, Math.min(16, ca.fingerprint().length())),
                httpsPort,
                "fp=" + ca.fingerprint() + ";v=der-sync-1");
            mdns.registerService(info);
            mdns.addServiceListener(PEER_SERVICE_TYPE, this);
            started.set(true);
            LOG.info("Peer discovery announcing {} as {}", PEER_SERVICE_TYPE, info.getName());
        } catch (final Exception ex) {
            LOG.warn("Peer discovery disabled — {}", ex.getMessage());
        }
    }

    @PreDestroy
    public void stopDiscovery() {
        if (mdns != null) {
            try {
                mdns.close();
            } catch (final Exception ignored) {
                // best-effort shutdown
            }
            mdns = null;
        }
    }

    @Override
    public void serviceAdded(final ServiceEvent event) {
        if (mdns != null) {
            mdns.requestServiceInfo(PEER_SERVICE_TYPE, event.getName(), 1500);
        }
    }

    @Override
    public void serviceRemoved(final ServiceEvent event) {
        LOG.debug("Peer service removed: {}", event.getName());
    }

    @Override
    public void serviceResolved(final ServiceEvent event) {
        final ServiceInfo si = event.getInfo();
        if (si == null) {
            return;
        }
        final String[] hosts = si.getHostAddresses();
        if (hosts == null || hosts.length == 0) {
            return;
        }
        String fp = null;
        String v = null;
        for (final String p : si.getTextString() == null ? new String[0]
                              : si.getTextString().split(";")) {
            if (p.startsWith("fp=")) {
                fp = p.substring(3);
            } else if (p.startsWith("v=")) {
                v = p.substring(2);
            }
        }
        if (fp != null && fp.equals(ca.fingerprint())) {
            return;
        }
        try {
            repo.upsertDiscovered(si.getName(), hosts[0],
                                    hosts[0] + ":" + si.getPort(),
                                    PEER_SERVICE_TYPE, v, fp);
        } catch (final Exception ex) {
            LOG.warn("peer-discovery upsert failed", ex);
        }
    }

    public List<Map<String, Object>> listDiscovered() {
        return repo.listDiscovered();
    }

    public int markReviewed(final UUID discoveredId, final UUID approvedPeerId) {
        return repo.markReviewed(discoveredId, approvedPeerId);
    }

    /* ─── Peer invite tokens ───────────────────────────────────── */

    public String issueInvite(final UUID issuedBy, final String note, final int ttlSeconds) {
        final byte[] raw = new byte[24];
        new SecureRandom().nextBytes(raw);
        final String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        final Instant expires = Instant.now().plusSeconds(Math.max(60, ttlSeconds));
        repo.insertInvite(sha256Hex(token), issuedBy, expires, note);
        return token;
    }

    public String tokenHash(final String token) {
        return sha256Hex(token);
    }

    public boolean consumeInvite(final String token, final String consumingEdgeFingerprint,
                                   final UUID peerId) {
        return repo.consumeInvite(sha256Hex(token), consumingEdgeFingerprint, peerId);
    }

    public List<Map<String, Object>> listInvites() {
        return repo.listInvites();
    }

    /* ─── Peer health monitor ──────────────────────────────────── */

    @Scheduled(fixedDelayString = "${der.network.peer.health.interval:60000}",
               initialDelayString = "${der.network.peer.health.initialDelay:20000}")
    public void sampleAllPeers() {
        for (final NetworkPeer p : networkRepo.listPeers()) {
            try {
                sampleOne(p);
            } catch (final Exception ex) {
                LOG.debug("peer health probe skipped for {}", p.nodeId(), ex);
            }
        }
    }

    private void sampleOne(final NetworkPeer p) throws Exception {
        if (p.endpoint() == null || p.endpoint().isBlank()) {
            repo.recordSample(p.id(), "DOWN", null, null, null, null, "no endpoint");
            return;
        }
        final String host = p.endpoint().split(":")[0];
        final URI uri = URI.create("https://" + host + ":" + httpsPort
                                    + "/edge-api/v1/system/health");
        final long t0 = System.nanoTime();
        try {
            final HttpResponse<String> r = http.send(
                HttpRequest.newBuilder(uri)
                           .timeout(Duration.ofSeconds(5))
                           .GET().build(),
                HttpResponse.BodyHandlers.ofString());
            final int latency = (int) ((System.nanoTime() - t0) / 1_000_000);
            if (r.statusCode() >= 200 && r.statusCode() < 300) {
                String version = null;
                try {
                    @SuppressWarnings("unchecked")
                    final Map<String, Object> body = mapper.readValue(r.body(), Map.class);
                    version = (String) body.get("version");
                } catch (final Exception ignored) {
                    // body not JSON
                }
                repo.recordSample(p.id(), "UP", latency, version, null,
                                   r.statusCode(), null);
            } else {
                repo.recordSample(p.id(), "DEGRADED", latency, null, null,
                                   r.statusCode(), "unexpected status");
            }
        } catch (final java.net.http.HttpTimeoutException te) {
            repo.recordSample(p.id(), "TIMEOUT", null, null, null, null, "probe timeout");
        } catch (final Exception ex) {
            repo.recordSample(p.id(), "DOWN", null, null, null, null,
                               ex.getMessage() == null ? ex.getClass().getSimpleName()
                                                        : ex.getMessage());
        }
    }

    public Map<String, Object> healthSummary(final UUID peerId) {
        return repo.healthSummary(peerId);
    }

    /* ─── Forward retry queue ──────────────────────────────────── */

    public void scheduleRetry(final UUID messageId, final String targetEdgeId,
                                final int attempt) {
        // Exponential backoff: 10 s, 30 s, 90 s, 4.5 min, 13.5 min, …
        final int delaySeconds = (int) Math.min(3600, 10 * Math.pow(3, attempt));
        repo.scheduleRetry(messageId, targetEdgeId,
                            Instant.now().plusSeconds(delaySeconds));
    }

    public List<Map<String, Object>> dueRetries() {
        return repo.dueRetries(50);
    }

    public void markRetryAttempt(final UUID retryId, final String outcome,
                                   final String reason, final int nextAttemptIndex,
                                   final boolean exhausted) {
        final int delaySeconds = (int) Math.min(3600, 10 * Math.pow(3, nextAttemptIndex));
        repo.markRetryAttempt(retryId, outcome, reason,
                                Instant.now().plusSeconds(delaySeconds), exhausted);
    }

    public void deleteRetry(final UUID retryId) {
        repo.deleteSettled(retryId);
    }

    public List<Map<String, Object>> retrySnapshot() {
        return repo.retryQueueSnapshot();
    }

    /* ─── Helpers ───────────────────────────────────────────────── */

    private static String sha256Hex(final String s) {
        try {
            final byte[] b = MessageDigest.getInstance("SHA-256")
                                           .digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(b);
        } catch (final Exception ex) {
            throw new IllegalStateException("SHA-256 missing", ex);
        }
    }
}
