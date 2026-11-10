package ug.ac.mak.der.device;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;

import ug.ac.mak.der.network.NetworkEntities;
import ug.ac.mak.der.network.NetworkRepository;

/**
 * UI-1 — single source of truth for every device the DER knows about.
 *
 * <p>DER maintains two separate device registries:
 *
 * <ul>
 *   <li>{@code edge_device} — the DHIS2 fleet registry. Rows are
 *       created when an operator signs in (bearer device enrolment).
 *       Carries status (PENDING / APPROVED / SUSPENDED / REVOKED),
 *       form factor, display name.</li>
 *   <li>{@code network_client} — the local-LAN mesh registry.
 *       Populated by the Access Point when a client associates with
 *       the WiFi / wired interface. Carries IP, MAC, signal strength,
 *       trust (PENDING / APPROVED / REVOKED).</li>
 * </ul>
 *
 * <p>Operators were seeing devices on one view and not the other:
 * a browser session at {@code http://localhost:5174/} registers in
 * {@code edge_device} but, being a loopback browser rather than a
 * LAN client, never shows up in {@code network_client}. This
 * service merges both tables into one list of "devices" the admin
 * UI can render in a single screen, with a {@code sources} array
 * that tells the operator where each device was observed from.</p>
 *
 * <p>Matching: a {@code network_client} row optionally carries
 * {@code der_device_id} pointing at an {@code edge_device.device_id}.
 * When set, the two rows are collapsed into one unified entry; when
 * unset, the network row stands alone.</p>
 */
@Service
public class UnifiedDeviceService {

    private final DeviceService fleetSvc;
    private final NetworkRepository networkRepo;

    public UnifiedDeviceService(final DeviceService fleetSvc,
                                 final NetworkRepository networkRepo) {
        this.fleetSvc = Objects.requireNonNull(fleetSvc, "fleetSvc");
        this.networkRepo = Objects.requireNonNull(networkRepo, "networkRepo");
    }

    /** Merged list across both registries. */
    public List<UnifiedDevice> list() {
        final List<EdgeDevice> fleet = fleetSvc.list();
        final List<NetworkEntities.NetworkClient> lan = networkRepo.listClients();

        final Map<UUID, EdgeDevice> fleetById = new HashMap<>();
        for (EdgeDevice d : fleet) {
            fleetById.put(d.deviceId(), d);
        }

        final List<UnifiedDevice> out = new ArrayList<>(fleet.size() + lan.size());
        final Map<UUID, UnifiedDevice> emittedByFleetId = new HashMap<>();

        // Pass 1 — every fleet row becomes a unified entry. LAN rows
        // that reference an existing fleet id attach onto it.
        for (EdgeDevice d : fleet) {
            final UnifiedDevice ud = fromFleet(d);
            out.add(ud);
            emittedByFleetId.put(d.deviceId(), ud);
        }
        // Pass 2 — walk LAN rows, attaching or standing alone.
        for (NetworkEntities.NetworkClient c : lan) {
            if (c.derDeviceId() != null
                    && emittedByFleetId.containsKey(c.derDeviceId())) {
                final UnifiedDevice existing =
                        emittedByFleetId.get(c.derDeviceId());
                existing.attachLan(c);
            } else {
                out.add(fromLan(c));
            }
        }
        // Sort: most-recent first on a composite recency key.
        out.sort((a, b) -> {
            final Instant ar = a.recency();
            final Instant br = b.recency();
            if (ar == null && br == null) {
                return 0;
            }
            if (ar == null) {
                return 1;
            }
            if (br == null) {
                return -1;
            }
            return br.compareTo(ar);
        });
        return out;
    }

    private static UnifiedDevice fromFleet(final EdgeDevice d) {
        final UnifiedDevice ud = new UnifiedDevice();
        ud.id = d.deviceId().toString();
        if (d.displayName() != null && !d.displayName().isBlank()) {
            ud.displayName = d.displayName();
        } else {
            ud.displayName = shortId(d.deviceId().toString());
        }
        ud.status = d.status().name();
        ud.formFactor = d.formFactor().name();
        ud.lastSeenAt = d.lastSeenAt();
        ud.enrolledAt = d.enrolledAt();
        ud.approvedAt = d.approvedAt();
        ud.userAgent = d.userAgent();
        ud.assignedUserId = d.assignedUserId() == null ? null
                : d.assignedUserId().toString();
        ud.firmwareVersion = d.firmwareVersion();
        ud.sources.add("DHIS2_FLEET");
        ud.fleetDeviceId = d.deviceId().toString();
        return ud;
    }

    private static UnifiedDevice fromLan(final NetworkEntities.NetworkClient c) {
        final UnifiedDevice ud = new UnifiedDevice();
        ud.id = c.deviceId();
        if (c.hostname() != null && !c.hostname().isBlank()) {
            ud.displayName = c.hostname();
        } else {
            ud.displayName = c.deviceId();
        }
        // Mirror the LAN trust state into the common status column so
        // UI filters work with a single enum.
        ud.status = switch (c.trust()) {
            case APPROVED -> "APPROVED";
            case REVOKED -> "REVOKED";
            default -> "PENDING";
        };
        ud.lastSeenAt = c.lastSeenAt();
        ud.enrolledAt = c.firstSeenAt();
        ud.approvedAt = c.approvedAt();
        ud.ip = c.ip();
        ud.mac = c.mac();
        ud.link = c.link() == null ? null : c.link().name();
        ud.signalDbm = c.signalDbm();
        ud.owner = c.owner();
        ud.sources.add("LAN_CLIENT");
        ud.networkClientId = c.deviceId();
        return ud;
    }

    private static String shortId(final String s) {
        if (s == null) {
            return "";
        }
        if (s.length() <= 8) {
            return s;
        }
        return s.substring(0, 8);
    }

    /** Flat DTO that collapses fields from both registries. */
    public static final class UnifiedDevice {
        public String id;
        public String displayName;
        public String status;
        public List<String> sources = new ArrayList<>();
        public String formFactor;
        public Instant lastSeenAt;
        public Instant enrolledAt;
        public Instant approvedAt;
        public String userAgent;
        public String firmwareVersion;
        public String assignedUserId;
        public String fleetDeviceId;
        public String networkClientId;
        public String ip;
        public String mac;
        public String link;
        public Integer signalDbm;
        public String owner;

        void attachLan(final NetworkEntities.NetworkClient c) {
            if (!sources.contains("LAN_CLIENT")) {
                sources.add("LAN_CLIENT");
            }
            networkClientId = c.deviceId();
            if (ip == null) {
                ip = c.ip();
            }
            if (mac == null) {
                mac = c.mac();
            }
            if (link == null && c.link() != null) {
                link = c.link().name();
            }
            if (signalDbm == null) {
                signalDbm = c.signalDbm();
            }
            if (owner == null) {
                owner = c.owner();
            }
            // LAN sighting can be more recent than DHIS2 heartbeat.
            if (c.lastSeenAt() != null
                    && (lastSeenAt == null
                        || c.lastSeenAt().isAfter(lastSeenAt))) {
                lastSeenAt = c.lastSeenAt();
            }
        }

        Instant recency() {
            if (lastSeenAt != null) {
                return lastSeenAt;
            }
            if (approvedAt != null) {
                return approvedAt;
            }
            return enrolledAt;
        }

        public Map<String, Object> toJson() {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("displayName", displayName);
            m.put("status", status);
            m.put("sources", sources);
            m.put("formFactor", formFactor);
            m.put("lastSeenAt", lastSeenAt == null ? null : lastSeenAt.toString());
            m.put("enrolledAt", enrolledAt == null ? null : enrolledAt.toString());
            m.put("approvedAt", approvedAt == null ? null : approvedAt.toString());
            m.put("userAgent", userAgent);
            m.put("firmwareVersion", firmwareVersion);
            m.put("assignedUserId", assignedUserId);
            m.put("fleetDeviceId", fleetDeviceId);
            m.put("networkClientId", networkClientId);
            m.put("ip", ip);
            m.put("mac", mac);
            m.put("link", link);
            m.put("signalDbm", signalDbm);
            m.put("owner", owner);
            return m;
        }
    }
}
