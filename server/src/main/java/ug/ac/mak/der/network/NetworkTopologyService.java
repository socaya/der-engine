package ug.ac.mak.der.network;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.device.DeviceAdjacencyService;
import ug.ac.mak.der.dhis2.Dhis2ConnectionConfig;
import ug.ac.mak.der.dhis2.Dhis2ConnectionConfigRepository;
import ug.ac.mak.der.network.NetworkEntities.NetworkClient;

/** §2.2.7 Mesh topology — combines facility devices + peer edges + WAN state
 *  into one view the admin UI renders as a live topology.
 *
 *  <p>Response shape follows the DER Mesh Topology spec §17:
 *  {@code { site, wan, der, devices[], peers[], connections[] } }.</p>
 */
@Service
public class NetworkTopologyService {

    private static final Duration ONLINE_WINDOW   = Duration.ofMinutes(2);
    private static final Duration DEGRADED_WINDOW = Duration.ofMinutes(10);

    private final NetworkCaService ca;
    private final NetworkRepository networkRepo;
    private final NetworkService network;
    private final ObjectProvider<DeviceAdjacencyService> adjacencies;
    private final ObjectProvider<Dhis2ConnectionConfigRepository> dhis2Config;
    private final JdbcTemplate jdbc;

    public NetworkTopologyService(final NetworkCaService ca,
                                    final NetworkRepository networkRepo,
                                    final NetworkService network,
                                    final ObjectProvider<DeviceAdjacencyService> adjacencies,
                                    final ObjectProvider<Dhis2ConnectionConfigRepository> dhis2Config,
                                    final JdbcTemplate jdbc) {
        this.ca = Objects.requireNonNull(ca, "ca");
        this.networkRepo = Objects.requireNonNull(networkRepo, "networkRepo");
        this.network = Objects.requireNonNull(network, "network");
        this.adjacencies = Objects.requireNonNull(adjacencies, "adjacencies");
        this.dhis2Config = Objects.requireNonNull(dhis2Config, "dhis2Config");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Map<String, Object> topology() {
        final Instant now = Instant.now();
        final NetworkEntities.NetworkStatus status = network.status();

        final Map<String, Object> site = new LinkedHashMap<>();
        site.put("id", "facility-local");
        site.put("name", "DER Facility");

        final Map<String, Object> wan = new LinkedHashMap<>();
        wan.put("status", status.centralDhis2Available() ? "online"
                : status.internetAvailable() ? "degraded" : "offline");
        wan.put("state", status.state().name());
        wan.put("centralDhis2Available", status.centralDhis2Available());
        wan.put("internetAvailable", status.internetAvailable());
        wan.put("lastProbeAt", status.lastProbeAt() == null ? null
                : status.lastProbeAt().toString());
        // §2.3.73 — tells the admin UI whether DHIS2 Central is a
        // local-only endpoint (loopback / der.local / *.local).
        // Dev + CI setups put both DHIS2 and DER on the same machine
        // so the probe is always "up" and the admin can't see what a
        // real uplink drop looks like; when centralIsLocal is true the
        // UI defaults the Internet node's Simulate control to ON so a
        // realistic cycle is depicted. In pilot deployments where
        // DHIS2 Central is a remote URL the UI shows the actual probe.
        wan.put("centralIsLocal", centralIsLocal());

        final Map<String, Object> der = new LinkedHashMap<>();
        der.put("id", "der");
        der.put("name", "DER Edge Runtime");
        der.put("type", "facility-server");
        der.put("status", "online");
        der.put("fingerprint", ca.fingerprint());
        der.put("ipAddress", Optional.ofNullable(status.gateway()).orElse("192.168.50.1"));
        der.put("hostname", status.hostname());
        der.put("centralBridge", status.centralDhis2Available());

        // §2.2.7 — one source of truth. The mesh view used to call
        // DeviceService.list() (der.edge_device fleet-level rows,
        // which include historical test imports) while the admin UI's
        // /network/clients tab read from der.network_client. That
        // split had the two screens showing different sets of
        // devices, which confused operators. Both views now read from
        // der.network_client via NetworkService.listClients() so a
        // device appears in the mesh only when it's on this LAN.
        //
        // Trust filter: the mesh view is a map of the operational
        // fabric, not a device-approval queue. PENDING / REVOKED /
        // BLOCKED devices are reviewed on the Devices screen; they
        // don't belong on the topology — their presence confuses
        // operators with "Device <uid>" placeholder labels before an
        // admin has approved them.
        // V120 — unified device table; the mesh view spans FLEET + LAN
        // observations. listAllForTopology() returns every row so an
        // approved browser session (FLEET-only, no LAN axis) renders as
        // a device even without an AP sighting.
        final List<NetworkClient> clients = network.listAllForTopology().stream()
                .filter(c -> c.trust() == NetworkEntities.ClientTrust.APPROVED)
                .toList();
        final List<Map<String, Object>> deviceJson = new ArrayList<>();
        final List<Map<String, Object>> connections = new ArrayList<>();
        for (final NetworkClient c : clients) {
            final String devStatus = statusForClient(c, now);
            final long pending = pendingFor(c);
            final boolean syncing = pending > 0 && !"offline".equals(devStatus);

            final Map<String, Object> dj = new LinkedHashMap<>();
            dj.put("id", c.deviceId());
            dj.put("name", clientDisplay(c));
            dj.put("type", "device");
            dj.put("formFactor", "UNKNOWN");
            dj.put("status", devStatus);
            dj.put("lastSeen", c.lastSeenAt() == null ? null : c.lastSeenAt().toString());
            dj.put("userAgent", null);
            dj.put("firmwareVersion", null);
            dj.put("deviceStatus", c.trust() == null ? "PENDING" : c.trust().name());
            dj.put("ip", c.ip());
            dj.put("mac", c.mac());
            dj.put("link", c.link() == null ? null : c.link().name());
            dj.put("owner", c.owner());

            final Map<String, Object> sync = new LinkedHashMap<>();
            sync.put("state", syncing ? "syncing" : (pending > 0 ? "pending" : "synced"));
            sync.put("pending", pending);
            dj.put("sync", sync);
            deviceJson.add(dj);

            final Map<String, Object> link = new LinkedHashMap<>();
            link.put("source", "der");
            link.put("target", c.deviceId());
            link.put("type", c.link() == null ? "wifi" : c.link().name());
            link.put("status", devStatus);
            connections.add(link);
        }

        // Device-to-device P2P adjacencies — rendered as dashed edges.
        // §2.2.9 spec §20: only emit links the discovery layer reports.
        final DeviceAdjacencyService ads = adjacencies.getIfAvailable();
        if (ads != null) {
            for (final Map<String, Object> adj : ads.list()) {
                final Map<String, Object> link = new LinkedHashMap<>();
                link.put("source", adj.get("deviceAId"));
                link.put("target", adj.get("deviceBId"));
                link.put("type", "p2p");
                link.put("linkType", adj.get("linkType"));
                final String st = Objects.toString(adj.get("state"), "active");
                link.put("status",
                    "active".equals(st) ? "online"
                  : "degraded".equals(st) ? "degraded"
                  : "offline");
                link.put("lastSeenAt", adj.get("lastSeenAt"));
                connections.add(link);
            }
        }

        // Peer edges (other DER appliances). Rendered on the topology
        // as an outer ring + emit a WAN-style connection each.
        final List<Map<String, Object>> peerJson = new ArrayList<>();
        for (final NetworkEntities.NetworkPeer p : networkRepo.listPeers()) {
            final String peerStatus = peerStatusFor(p);
            final Map<String, Object> pj = new LinkedHashMap<>();
            pj.put("id", "peer-" + p.id().toString());
            pj.put("name", p.nodeId() == null ? p.endpoint() : p.nodeId());
            pj.put("type", "peer-edge");
            pj.put("status", peerStatus);
            pj.put("endpoint", p.endpoint());
            pj.put("state", p.state() == null ? null : p.state().name());
            pj.put("trust", p.trust() == null ? null : p.trust().name());
            pj.put("lastHandshake", p.lastHandshake() == null ? null
                    : p.lastHandshake().toString());
            peerJson.add(pj);

            final Map<String, Object> link = new LinkedHashMap<>();
            link.put("source", "der");
            link.put("target", "peer-" + p.id().toString());
            link.put("type", "p2p");
            link.put("status", peerStatus);
            connections.add(link);
        }

        final Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("devices", deviceJson.size());
        summary.put("devicesOnline", (int) deviceJson.stream()
                .filter(d -> "online".equals(d.get("status"))).count());
        summary.put("devicesDegraded", (int) deviceJson.stream()
                .filter(d -> "degraded".equals(d.get("status"))).count());
        summary.put("devicesOffline", (int) deviceJson.stream()
                .filter(d -> "offline".equals(d.get("status"))).count());
        summary.put("syncQueueTotal", deviceJson.stream()
                .mapToLong(d -> ((Number) ((Map<?, ?>) d.get("sync")).get("pending")).longValue())
                .sum());
        summary.put("peers", peerJson.size());
        summary.put("peersConnected", (int) peerJson.stream()
                .filter(p -> "online".equals(p.get("status"))).count());
        summary.put("wanStatus", wan.get("status"));

        final Map<String, Object> root = new LinkedHashMap<>();
        root.put("site", site);
        root.put("wan", wan);
        root.put("der", der);
        root.put("devices", deviceJson);
        root.put("peers", peerJson);
        root.put("connections", connections);
        root.put("summary", summary);
        return root;
    }

    private static String clientDisplay(final NetworkClient c) {
        if (c.displayName() != null && !c.displayName().isBlank()) {
            return c.displayName();
        }
        if (c.hostname() != null && !c.hostname().isBlank()) {
            return c.hostname();
        }
        if (c.owner() != null && !c.owner().isBlank()) {
            return c.owner();
        }
        if (c.ip() != null && !c.ip().isBlank()) {
            return c.ip();
        }
        return "Unnamed device";
    }

    /** ONLINE if last-seen within 2 min, DEGRADED up to 10 min, OFFLINE after.
     *  REVOKED / PENDING devices are OFFLINE regardless of heartbeat. */
    private static String statusForClient(final NetworkClient c, final Instant now) {
        if (c.trust() == null
            || c.trust() == NetworkEntities.ClientTrust.REVOKED
            || c.trust() == NetworkEntities.ClientTrust.BLOCKED) {
            return "offline";
        }
        if (c.lastSeenAt() == null) {
            return "offline";
        }
        final Duration age = Duration.between(c.lastSeenAt(), now);
        if (age.compareTo(ONLINE_WINDOW) <= 0) {
            return "online";
        }
        if (age.compareTo(DEGRADED_WINDOW) <= 0) {
            return "degraded";
        }
        return "offline";
    }

    private static String peerStatusFor(final NetworkEntities.NetworkPeer p) {
        if (p.state() == null) {
            return "offline";
        }
        return switch (p.state()) {
            case CONNECTED -> "online";
            case HANDSHAKING -> "degraded";
            default -> "offline";
        };
    }

    /** Pending ops for this client, resolved by device_id → user via
     *  the device_profile table. Returns 0 when we can't attribute. */
    private long pendingFor(final NetworkClient c) {
        if (c.deviceId() == null) {
            return 0L;
        }
        try {
            final Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM operation_journal j "
              + "JOIN der.device_profile p ON p.user_id = j.submitted_by "
              + "WHERE p.device_id::text = ? "
              + "AND j.state IN ('PENDING','RETRYABLE','UNKNOWN_OUTCOME')",
                Long.class, c.deviceId());
            return n == null ? 0L : n;
        } catch (Exception ex) {
            return 0L;
        }
    }

    /** True when the configured DHIS2 Central base URL points at a local
     *  endpoint — loopback, der.local, or any *.local hostname. Used by
     *  the admin UI to decide whether to default the Internet node's
     *  Simulate control to ON (so a dev/CI box without a real uplink
     *  still demonstrates the edge-first offline-capable behaviour). */
    private boolean centralIsLocal() {
        final Dhis2ConnectionConfigRepository repo = dhis2Config.getIfAvailable();
        if (repo == null) {
            return false;
        }
        final Dhis2ConnectionConfig cfg;
        try {
            cfg = repo.read();
        } catch (Exception ex) {
            return false;
        }
        if (cfg == null || cfg.baseUrl() == null) {
            return false;
        }
        final String url = cfg.baseUrl().toLowerCase(java.util.Locale.ROOT);
        return url.contains("://localhost")
            || url.contains("://127.0.0.1")
            || url.contains("://[::1]")
            || url.contains("://der.local")
            || url.matches(".*://[^/]*\\.local(:|/|$).*");
    }
}
