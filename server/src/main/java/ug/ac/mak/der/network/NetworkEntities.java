package ug.ac.mak.der.network;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** All Network-module value objects collected in one file.
 *
 * <p>Backs the Phase N1-N5 schema introduced in V031. Each record maps
 * one-to-one to a UI-visible shape (see {@code admin-ui/src/api/edgeApi.ts}
 * Network types) so the controller layer is a thin JSON wrapper. */
public final class NetworkEntities {
    private NetworkEntities() { }

    /* ─── Phase N3 — connectivity state ──────────────────────────── */

    public enum ConnectivityState {
        CONNECTED, OFFLINE_FIRST, RECOVERING,
        LOCAL_NETWORK_DEGRADED, EDGE_NETWORK_UNAVAILABLE,
        CENTRAL_AUTH_FAILURE, DNS_FAILURE, CERTIFICATE_FAILURE;
    }

    public record NetworkStatus(
            ConnectivityState state,
            boolean localApAvailable,
            boolean localLanAvailable,
            boolean internetAvailable,
            boolean centralDhis2Available,
            boolean dnsAvailable,
            String gateway, String subnet, String hostname,
            Instant lastProbeAt,
            List<String> warnings) { }

    /* ─── Phase N1 + N4 — interfaces + routes ────────────────────── */

    public enum InterfaceKind { wifi, ethernet, cellular, virtual, loopback }
    public enum InterfaceState { up, down, degraded, unknown }
    public enum InterfacePurpose {
        LOCAL_AP("local-ap"), FACILITY_LAN("facility-lan"),
        UPSTREAM_WIFI("upstream-wifi"), CELLULAR_FALLBACK("cellular-fallback"),
        UNKNOWN("unknown");
        public final String wire;
        InterfacePurpose(final String wire) {
            this.wire = wire;
        }
        public static InterfacePurpose fromWire(final String s) {
            if (s == null) {
                return UNKNOWN;
            }
            for (InterfacePurpose p : values()) {
                if (p.wire.equals(s)) {
                    return p;
                }
            }
            return UNKNOWN;
        }
    }

    public record NetworkInterface(
            String name, InterfaceKind kind, InterfaceState state,
            InterfacePurpose purpose, String address, String mac,
            Long rxBytes, Long txBytes, String linkSpeed, int priority) { }

    public record NetworkRoute(
            UUID id, String destination, String gateway,
            String interfaceName, int metric, String source, boolean active) { }

    /* ─── Phase N1 — Access Point ────────────────────────────────── */

    public record AccessPointStatus(
            boolean running, boolean enabled, String interfaceName, String ssid,
            String band, int channel, String security,
            int clients, boolean dhcpActive, String gateway,
            String subnet, String edgeId, Instant startedAt,
            Instant networkKeyRotatedAt) { }

    /* ─── Phase N2 — clients + events ────────────────────────────── */

    public enum ClientTrust { PENDING, APPROVED, REVOKED, BLOCKED, UNKNOWN }
    public enum ClientLink { wifi, ethernet, cellular }

    public record NetworkClient(
            String deviceId, UUID derDeviceId, String owner, String hostname,
            String ip, String mac, ClientLink link, Integer signalDbm,
            ClientTrust trust, String certificateFingerprint,
            Long bytesTx, Long bytesRx,
            Instant firstSeenAt, Instant lastSeenAt,
            UUID approvedBy, Instant approvedAt, Instant revokedAt) { }

    public record NetworkEvent(
            UUID eventId, String eventType, String outcome,
            String deviceId, String nodeId, String interfaceName,
            String actor, String reason, String correlationId,
            Instant observedAt) { }

    /* ─── Phase N5 — peers ───────────────────────────────────────── */

    public enum PeerState { CONNECTED, HANDSHAKING, DISCONNECTED, ERROR }
    public enum PeerTrust { TRUSTED, UNVERIFIED, REVOKED }

    public record NetworkPeer(
            UUID id, String nodeId, String siteId, String endpoint,
            String publicKey, String allowedIps,
            PeerState state, PeerTrust trust,
            Long rxBytes, Long txBytes, Instant lastHandshake, Instant addedAt) { }

    /* ─── Security — firewall policy ─────────────────────────────── */

    public enum PolicyAction { allow, controlled, deny }

    public record PolicyRule(
            UUID id, int position, String sourceZone, String destinationZone,
            PolicyAction action, String note, Instant updatedAt) { }
}
