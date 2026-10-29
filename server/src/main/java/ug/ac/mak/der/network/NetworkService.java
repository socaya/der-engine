package ug.ac.mak.der.network;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.network.NetworkEntities.AccessPointStatus;
import ug.ac.mak.der.network.NetworkEntities.ClientTrust;
import ug.ac.mak.der.network.NetworkEntities.ConnectivityState;
import ug.ac.mak.der.network.NetworkEntities.InterfaceState;
import ug.ac.mak.der.network.NetworkEntities.NetworkClient;
import ug.ac.mak.der.network.NetworkEntities.NetworkEvent;
import ug.ac.mak.der.network.NetworkEntities.NetworkInterface;
import ug.ac.mak.der.network.NetworkEntities.NetworkPeer;
import ug.ac.mak.der.network.NetworkEntities.NetworkRoute;
import ug.ac.mak.der.network.NetworkEntities.NetworkStatus;
import ug.ac.mak.der.network.NetworkEntities.PeerState;
import ug.ac.mak.der.network.NetworkEntities.PolicyRule;

/** Core business logic for the Network control plane. Phase N1-N5. */
@Service
public class NetworkService {

    private final NetworkRepository repo;
    private final NetworkAgent agent;
    private final JdbcTemplate jdbc;

    public NetworkService(final NetworkRepository repo,
                           final NetworkAgent agent,
                           final JdbcTemplate jdbc) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.agent = Objects.requireNonNull(agent, "agent");
        this.jdbc  = Objects.requireNonNull(jdbc, "jdbc");
    }

    /* ─── Phase N3 — state + probes ─────────────────────────────── */

    public NetworkStatus status() {
        return repo.loadStatus();
    }

    /** Periodic connectivity probe. Runs every 30s; results feed the
     *  state machine so the UI's /network/status reflects live reality. */
    @Scheduled(fixedDelayString = "${der.network.probe.interval:30000}",
               initialDelayString = "${der.network.probe.initialDelay:5000}")
    public void runProbes() {
        // Probes stay OUTSIDE a transaction — one failed JDBC lookup
        // mustn't poison the subsequent updateStatus/recordProbe calls.
        final String centralUrl = loadCentralUrl();
        final AccessPointStatus ap = repo.loadAp();
        final boolean apUp = ap.running();
        final boolean lanUp = probeHost("127.0.0.1", 8085, 500);
        final boolean dnsUp = probeHost("8.8.8.8", 53, 1500);
        final boolean internetUp = dnsUp || probeHost("1.1.1.1", 443, 1500);
        final boolean centralUp = probeCentralUrl(centralUrl);
        final ConnectivityState state = classify(apUp, lanUp, internetUp, dnsUp, centralUp);
        persistProbe(apUp, lanUp, internetUp, dnsUp, centralUp, state);
    }

    @Transactional
    protected void persistProbe(final boolean apUp, final boolean lanUp,
                                   final boolean internetUp, final boolean dnsUp,
                                   final boolean centralUp, final ConnectivityState state) {
        repo.updateStatus(lanUp, internetUp, dnsUp, centralUp, apUp, state);
        repo.recordProbe("LAN",      lanUp,      null, null);
        repo.recordProbe("DNS",      dnsUp,      null, null);
        repo.recordProbe("INTERNET", internetUp, null, null);
        repo.recordProbe("CENTRAL",  centralUp,  null, null);
    }

    private static boolean probeHost(final String host, final int port, final int timeoutMs) {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), timeoutMs);
            return true;
        } catch (final Exception ex) {
            return false;
        }
    }

    private String loadCentralUrl() {
        try {
            return jdbc.queryForObject(
                "SELECT base_url FROM der.dhis2_connection_config "
              + "WHERE singleton = TRUE LIMIT 1",
                String.class);
        } catch (final Exception ex) {
            return null;
        }
    }

    private boolean probeCentralUrl(final String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        try {
            final java.net.URI uri = java.net.URI.create(url);
            final int port;
            if (uri.getPort() > 0) {
                port = uri.getPort();
            } else if ("https".equals(uri.getScheme())) {
                port = 443;
            } else {
                port = 80;
            }
            return probeHost(uri.getHost(), port, 2000);
        } catch (final Exception ex) {
            return false;
        }
    }

    private static ConnectivityState classify(
            final boolean ap, final boolean lan, final boolean inet,
            final boolean dns, final boolean central) {
        if (central && lan) {
            return ConnectivityState.CONNECTED;
        }
        if (!dns && inet) {
            return ConnectivityState.DNS_FAILURE;
        }
        if (lan && !inet) {
            return ConnectivityState.OFFLINE_FIRST;
        }
        if (lan && inet && !central) {
            return ConnectivityState.EDGE_NETWORK_UNAVAILABLE;
        }
        if (!lan) {
            return ConnectivityState.LOCAL_NETWORK_DEGRADED;
        }
        return ConnectivityState.RECOVERING;
    }

    /* ─── Phase N1 — Access Point ───────────────────────────────── */

    public AccessPointStatus accessPoint() {
        return repo.loadAp();
    }

    @Transactional
    public boolean startAp(final String actor) {
        final AccessPointStatus ap = repo.loadAp();
        if (ap.running()) {
            return true;
        }
        final boolean ok = agent.startAccessPoint(ap.ssid(), ap.security());
        if (ok) {
            repo.setApRunning(true);
            repo.recordEvent("AP_STARTED", "SUCCESS", null, null, ap.interfaceName(),
                              actor, null, null);
        } else {
            repo.recordEvent("AP_STARTED", "FAILURE", null, null, ap.interfaceName(),
                              actor, "agent returned false", null);
        }
        return ok;
    }

    @Transactional
    public boolean stopAp(final String actor) {
        final AccessPointStatus ap = repo.loadAp();
        if (!ap.running()) {
            return true;
        }
        final boolean ok = agent.stopAccessPoint();
        if (ok) {
            repo.setApRunning(false);
            repo.recordEvent("AP_STOPPED", "SUCCESS", null, null, ap.interfaceName(),
                              actor, null, null);
        }
        return ok;
    }

    @Transactional
    public boolean restartAp(final String actor) {
        final AccessPointStatus ap = repo.loadAp();
        final boolean ok = agent.restartAccessPoint(ap.ssid(), ap.security());
        if (ok) {
            repo.setApRunning(true);
            repo.recordEvent("AP_RESTARTED", "SUCCESS", null, null, ap.interfaceName(),
                              actor, null, null);
        }
        return ok;
    }

    @Transactional
    public Instant rotateApKey(final String actor) {
        final String hash = agent.rotateApKey();
        repo.rotateApKey(hash);
        repo.recordEvent("NETWORK_KEY_ROTATED", "SUCCESS",
                          null, null, repo.loadAp().interfaceName(),
                          actor, null, null);
        return Instant.now();
    }

    /** Phase N2 — QR enrolment payload. Returns a minimal SVG that any
     *  stock QR renderer can replace with a real code once the Phase N2
     *  WPA3-SAE enrolment flow lands. Encodes the SSID + fingerprint. */
    public Map<String, Object> enrolmentQr() {
        final AccessPointStatus ap = repo.loadAp();
        final String payload = "WIFI:T:WPA;S:" + ap.ssid() + ";H:true;;";
        final Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("ssid", ap.ssid());
        m.put("payload", payload);
        m.put("qrSvg", renderQrPlaceholder(payload));
        m.put("expiresAt", null);
        return m;
    }
    /** Visually-correct QR grid placeholder. Deterministic from the
     *  payload so each SSID renders a stable image. For a scanner-readable
     *  QR, drop ZXing on the classpath at deploy time and replace the
     *  grid loop with {@code com.google.zxing.qrcode.QRCodeWriter}. */
    private static String renderQrPlaceholder(final String payload) {
        final int modules = 29;              // version 3 QR size
        final int cell    = 8;
        final int quiet   = 2 * cell;
        final int size    = modules * cell + 2 * quiet;
        final byte[] hash;
        try {
            hash = java.security.MessageDigest.getInstance("SHA-256").digest(
                       payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (final java.security.NoSuchAlgorithmException ex) {
            return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
                 + "<rect width='100' height='100' fill='white'/></svg>";
        }
        final StringBuilder sb = new StringBuilder(8192);
        sb.append("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ")
          .append(size).append(' ').append(size).append("' shape-rendering='crispEdges'>")
          .append("<rect width='").append(size).append("' height='").append(size)
          .append("' fill='white'/>");
        for (int y = 0; y < modules; y++) {
            for (int x = 0; x < modules; x++) {
                if (isFinder(x, y, modules) || isTiming(x, y, modules)) {
                    continue;
                }
                final int idx = (y * modules + x) % (hash.length * 8);
                final int bit = (hash[idx / 8] >> (idx % 8)) & 1;
                if (bit == 1) {
                    sb.append("<rect x='").append(quiet + x * cell)
                      .append("' y='").append(quiet + y * cell)
                      .append("' width='").append(cell).append("' height='").append(cell)
                      .append("' fill='#111'/>");
                }
            }
        }
        drawFinder(sb, quiet, quiet, cell);
        drawFinder(sb, quiet + (modules - 7) * cell, quiet, cell);
        drawFinder(sb, quiet, quiet + (modules - 7) * cell, cell);
        for (int i = 8; i < modules - 8; i++) {
            if ((i & 1) == 0) {
                sb.append("<rect x='").append(quiet + i * cell).append("' y='")
                  .append(quiet + 6 * cell).append("' width='").append(cell)
                  .append("' height='").append(cell).append("' fill='#111'/>");
                sb.append("<rect x='").append(quiet + 6 * cell).append("' y='")
                  .append(quiet + i * cell).append("' width='").append(cell)
                  .append("' height='").append(cell).append("' fill='#111'/>");
            }
        }
        sb.append("</svg>");
        return sb.toString();
    }

    private static boolean isFinder(final int x, final int y, final int modules) {
        return (x < 8 && y < 8)
            || (x >= modules - 8 && y < 8)
            || (x < 8 && y >= modules - 8);
    }
    private static boolean isTiming(final int x, final int y, final int modules) {
        return (x == 6 || y == 6) && x < modules && y < modules;
    }
    private static void drawFinder(final StringBuilder sb, final int ox,
                                     final int oy, final int cell) {
        sb.append("<rect x='").append(ox).append("' y='").append(oy)
          .append("' width='").append(7 * cell).append("' height='").append(7 * cell)
          .append("' fill='#111'/>")
          .append("<rect x='").append(ox + cell).append("' y='").append(oy + cell)
          .append("' width='").append(5 * cell).append("' height='").append(5 * cell)
          .append("' fill='white'/>")
          .append("<rect x='").append(ox + 2 * cell).append("' y='").append(oy + 2 * cell)
          .append("' width='").append(3 * cell).append("' height='").append(3 * cell)
          .append("' fill='#111'/>");
    }

    /* ─── Phase N1 + N4 — interfaces + routes ──────────────────── */

    public List<NetworkInterface> listInterfaces() {
        return repo.listInterfaces();
    }

    public List<NetworkRoute> listRoutes() {
        return repo.listRoutes();
    }

    @Transactional
    public boolean setInterfaceState(final String name, final InterfaceState state,
                                       final String actor) {
        final boolean up = state == InterfaceState.up;
        final boolean ok = agent.setInterfaceState(name, up);
        if (ok) {
            repo.setInterfaceState(name, state);
            repo.recordEvent(up ? "IFACE_UP" : "IFACE_DOWN",
                              "SUCCESS", null, null, name, actor, null, null);
        }
        return ok;
    }

    /* ─── Phase N2 — clients + events ───────────────────────────── */

    public List<NetworkClient> listClients() {
        return repo.listClients();
    }

    /** Phase N2 — a client that scanned the QR + joined DER-EDGE calls
     *  this endpoint from <code>https://der.local</code>. Lands as
     *  PENDING; an operator approves from the Clients page. */
    @Transactional
    public NetworkClient enrolClient(final String deviceId, final String owner,
                                       final String hostname, final String ip,
                                       final String mac,
                                       final NetworkEntities.ClientLink link,
                                       final String certFingerprint) {
        final NetworkClient c = repo.upsertEnrol(deviceId, owner, hostname, ip, mac,
                                                  link == null
                                                  ? NetworkEntities.ClientLink.wifi
                                                  : link,
                                                  certFingerprint);
        repo.recordEvent("DEVICE_CONNECTED", "SUCCESS", deviceId, null, null,
                          owner, null, null);
        return c;
    }

    /** Phase N1 — the DHCP server pushes leases through this hook when
     *  a client is granted an address. The default agent accumulates
     *  these so {@link #listClients()} can cross-reference by MAC. */
    @Transactional
    public int syncLeases(final List<Map<String, Object>> leases) {
        int applied = 0;
        for (final Map<String, Object> l : leases) {
            final String mac = (String) l.get("mac");
            final String ip  = (String) l.get("ip");
            if (mac == null || ip == null) {
                continue;
            }
            final String host = (String) l.get("hostname");
            final Number lease = (Number) l.getOrDefault("leaseSeconds", 86400);
            final boolean st = Boolean.TRUE.equals(l.get("static"));
            applied += repo.upsertLease(mac, ip, host, lease.longValue(), st);
        }
        repo.clearStaleLeases();
        return applied;
    }

    public int leaseCount() {
        return repo.countLeases();
    }

    @Transactional
    public boolean approveClient(final String deviceId, final UUID actor) {
        if (repo.findClient(deviceId).isEmpty()) {
            return false;
        }
        repo.updateClientTrust(deviceId, ClientTrust.APPROVED, actor);
        repo.recordEvent("DEVICE_APPROVED", "SUCCESS", deviceId, null, null,
                          actor != null ? actor.toString() : null, null, null);
        return true;
    }

    @Transactional
    public boolean revokeClient(final String deviceId, final UUID actor) {
        if (repo.findClient(deviceId).isEmpty()) {
            return false;
        }
        repo.updateClientTrust(deviceId, ClientTrust.REVOKED, actor);
        repo.recordEvent("DEVICE_REVOKED", "SUCCESS", deviceId, null, null,
                          actor != null ? actor.toString() : null, null, null);
        return true;
    }

    @Transactional
    public boolean blockClient(final String deviceId, final UUID actor) {
        if (repo.findClient(deviceId).isEmpty()) {
            return false;
        }
        repo.updateClientTrust(deviceId, ClientTrust.BLOCKED, actor);
        repo.recordEvent("DEVICE_BLOCKED", "SUCCESS", deviceId, null, null,
                          actor != null ? actor.toString() : null, null, null);
        return true;
    }

    @Transactional
    public boolean unblockClient(final String deviceId, final UUID actor) {
        if (repo.findClient(deviceId).isEmpty()) {
            return false;
        }
        repo.updateClientTrust(deviceId, ClientTrust.PENDING, actor);
        repo.recordEvent("DEVICE_UNBLOCKED", "SUCCESS", deviceId, null, null,
                          actor != null ? actor.toString() : null, null, null);
        return true;
    }

    public List<NetworkEvent> listEvents(final int limit) {
        return repo.listEvents(limit);
    }

    @Transactional
    public int clearEvents(final String actor) {
        final int n = repo.clearEvents();
        repo.recordEvent("AUDIT_CLEARED", "SUCCESS", null, null, null, actor,
                          "cleared " + n + " events", null);
        return n;
    }

    /* ─── Phase N5 — peers ──────────────────────────────────────── */

    public List<NetworkPeer> listPeers() {
        return repo.listPeers();
    }

    @Transactional
    public boolean connectPeer(final UUID id, final String actor) {
        final NetworkPeer p = repo.findPeer(id).orElse(null);
        if (p == null) {
            return false;
        }
        final boolean ok = agent.peerConnect(p.endpoint(), p.publicKey());
        if (ok) {
            repo.setPeerState(id, PeerState.CONNECTED);
            repo.recordEvent("PEER_CONNECTED", "SUCCESS", null, p.nodeId(), null,
                              actor, null, null);
        }
        return ok;
    }

    @Transactional
    public boolean disconnectPeer(final UUID id, final String actor) {
        final NetworkPeer p = repo.findPeer(id).orElse(null);
        if (p == null) {
            return false;
        }
        final boolean ok = agent.peerDisconnect(p.publicKey());
        if (ok) {
            repo.setPeerState(id, PeerState.DISCONNECTED);
            repo.recordEvent("PEER_DISCONNECTED", "SUCCESS", null, p.nodeId(), null,
                              actor, null, null);
        }
        return ok;
    }

    @Transactional
    public boolean removePeer(final UUID id, final String actor) {
        final NetworkPeer p = repo.findPeer(id).orElse(null);
        if (p == null) {
            return false;
        }
        agent.peerDisconnect(p.publicKey());
        final boolean removed = repo.deletePeer(id) > 0;
        if (removed) {
            repo.recordEvent("PEER_REMOVED", "SUCCESS", null, p.nodeId(), null,
                              actor, null, null);
        }
        return removed;
    }

    /* ─── Security policy ───────────────────────────────────────── */

    public List<PolicyRule> listRules() {
        return repo.listRules();
    }

    /* ─── Settings ──────────────────────────────────────────────── */

    public Map<String, String> settings() {
        return repo.loadSettings();
    }

    @Transactional
    public int putSetting(final String key, final String value, final String actor) {
        final int n = repo.putSetting(key, value);
        if (n > 0) {
            repo.recordEvent("NETWORK_SETTING_UPDATED", "SUCCESS",
                              null, null, null, actor, key + " = " + value, null);
        }
        return n;
    }
}
