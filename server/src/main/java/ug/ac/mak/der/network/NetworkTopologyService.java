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

import ug.ac.mak.der.device.DeviceService;
import ug.ac.mak.der.device.EdgeDevice;

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
    private final ObjectProvider<DeviceService> devices;
    private final JdbcTemplate jdbc;

    public NetworkTopologyService(final NetworkCaService ca,
                                    final NetworkRepository networkRepo,
                                    final NetworkService network,
                                    final ObjectProvider<DeviceService> devices,
                                    final JdbcTemplate jdbc) {
        this.ca = Objects.requireNonNull(ca, "ca");
        this.networkRepo = Objects.requireNonNull(networkRepo, "networkRepo");
        this.network = Objects.requireNonNull(network, "network");
        this.devices = Objects.requireNonNull(devices, "devices");
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

        final Map<String, Object> der = new LinkedHashMap<>();
        der.put("id", "der");
        der.put("name", "DER Edge Runtime");
        der.put("type", "facility-server");
        der.put("status", "online");
        der.put("fingerprint", ca.fingerprint());
        der.put("ipAddress", Optional.ofNullable(status.gateway()).orElse("192.168.50.1"));
        der.put("hostname", status.hostname());
        der.put("centralBridge", status.centralDhis2Available());

        final DeviceService ds = devices.getIfAvailable();
        final List<EdgeDevice> deviceList = ds == null ? List.of() : ds.list();
        final List<Map<String, Object>> deviceJson = new ArrayList<>();
        final List<Map<String, Object>> connections = new ArrayList<>();
        for (final EdgeDevice d : deviceList) {
            final String devStatus = statusFor(d, now);
            final long pending = pendingFor(d);
            final boolean syncing = pending > 0 && !"offline".equals(devStatus);

            final Map<String, Object> dj = new LinkedHashMap<>();
            dj.put("id", d.deviceId().toString());
            dj.put("name", display(d));
            dj.put("type", d.formFactor().name().toLowerCase());
            dj.put("formFactor", d.formFactor().name());
            dj.put("status", devStatus);
            dj.put("lastSeen", d.lastSeenAt() == null ? null : d.lastSeenAt().toString());
            dj.put("userAgent", d.userAgent());
            dj.put("firmwareVersion", d.firmwareVersion());
            dj.put("deviceStatus", d.status().name());

            final Map<String, Object> sync = new LinkedHashMap<>();
            sync.put("state", syncing ? "syncing" : (pending > 0 ? "pending" : "synced"));
            sync.put("pending", pending);
            dj.put("sync", sync);
            deviceJson.add(dj);

            // LAN connection der → device
            final Map<String, Object> link = new LinkedHashMap<>();
            link.put("source", "der");
            link.put("target", d.deviceId().toString());
            link.put("type", d.formFactor() == EdgeDevice.FormFactor.MOBILE ? "p2p" : "wifi");
            link.put("status", devStatus);
            connections.add(link);
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

    private static String display(final EdgeDevice d) {
        if (d.displayName() != null && !d.displayName().isBlank()) {
            return d.displayName();
        }
        return "Device " + d.deviceId().toString().substring(0, 8);
    }

    /** ONLINE if last-seen within 2 min, DEGRADED up to 10 min, OFFLINE after.
     *  SUSPENDED/REVOKED/PENDING devices are OFFLINE regardless of heartbeat. */
    private static String statusFor(final EdgeDevice d, final Instant now) {
        if (d.status() != EdgeDevice.Status.APPROVED) {
            return "offline";
        }
        if (d.lastSeenAt() == null) {
            return "offline";
        }
        final Duration age = Duration.between(d.lastSeenAt(), now);
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

    /** Pending ops attributed to this device's assigned user. If the device
     *  has no user, we can't attribute journal rows and return 0. */
    private long pendingFor(final EdgeDevice d) {
        if (d.assignedUserId() == null) {
            return 0L;
        }
        try {
            final Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM operation_journal "
              + "WHERE submitted_by = ? AND state IN ('PENDING','RETRYABLE','UNKNOWN_OUTCOME')",
                Long.class, d.assignedUserId());
            return n == null ? 0L : n;
        } catch (Exception ex) {
            return 0L;
        }
    }
}
