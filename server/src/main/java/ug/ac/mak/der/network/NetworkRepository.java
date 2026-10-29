package ug.ac.mak.der.network;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import ug.ac.mak.der.network.NetworkEntities.AccessPointStatus;
import ug.ac.mak.der.network.NetworkEntities.ClientLink;
import ug.ac.mak.der.network.NetworkEntities.ClientTrust;
import ug.ac.mak.der.network.NetworkEntities.ConnectivityState;
import ug.ac.mak.der.network.NetworkEntities.InterfaceKind;
import ug.ac.mak.der.network.NetworkEntities.InterfacePurpose;
import ug.ac.mak.der.network.NetworkEntities.InterfaceState;
import ug.ac.mak.der.network.NetworkEntities.NetworkClient;
import ug.ac.mak.der.network.NetworkEntities.NetworkEvent;
import ug.ac.mak.der.network.NetworkEntities.NetworkInterface;
import ug.ac.mak.der.network.NetworkEntities.NetworkPeer;
import ug.ac.mak.der.network.NetworkEntities.NetworkRoute;
import ug.ac.mak.der.network.NetworkEntities.NetworkStatus;
import ug.ac.mak.der.network.NetworkEntities.PeerState;
import ug.ac.mak.der.network.NetworkEntities.PeerTrust;
import ug.ac.mak.der.network.NetworkEntities.PolicyAction;
import ug.ac.mak.der.network.NetworkEntities.PolicyRule;

/** All JDBC read/write ops for the Network control plane.
 *  Thin, intentionally monolithic — one class per phase table group
 *  would just scatter the SQL across the module. */
@Repository
public class NetworkRepository {

    private final JdbcTemplate jdbc;

    public NetworkRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /* ─── State ─────────────────────────────────────────────────── */

    public NetworkStatus loadStatus() {
        return jdbc.queryForObject(
            "SELECT ns.state, ns.local_ap_available, ns.local_lan_available, "
          + "       ns.internet_available, ns.central_available, ns.dns_available, "
          + "       ns.last_probe_at, ns.hostname, "
          + "       (SELECT value FROM der.network_settings WHERE key='lan.gateway') AS gateway, "
          + "       (SELECT value FROM der.network_settings WHERE key='lan.subnet')  AS subnet "
          + "  FROM der.network_state ns WHERE ns.id = 1",
            (ResultSet rs, int row) -> new NetworkStatus(
                ConnectivityState.valueOf(rs.getString("state")),
                rs.getBoolean("local_ap_available"),
                rs.getBoolean("local_lan_available"),
                rs.getBoolean("internet_available"),
                rs.getBoolean("central_available"),
                rs.getBoolean("dns_available"),
                rs.getString("gateway"), rs.getString("subnet"),
                rs.getString("hostname"),
                optInstant(rs.getTimestamp("last_probe_at")),
                List.of()));
    }

    public void updateStatus(final boolean lanUp, final boolean internetUp,
                              final boolean dnsUp, final boolean centralUp,
                              final boolean apUp, final ConnectivityState state) {
        jdbc.update(
            "UPDATE der.network_state SET state=?, local_ap_available=?, "
          + "       local_lan_available=?, internet_available=?, "
          + "       dns_available=?, central_available=?, last_probe_at=now(), "
          + "       updated_at=now() WHERE id=1",
            state.name(), apUp, lanUp, internetUp, dnsUp, centralUp);
    }

    public void recordProbe(final String kind, final boolean success,
                              final Integer latencyMs, final String message) {
        jdbc.update(
            "INSERT INTO der.network_probe (kind, outcome, latency_ms, message) "
          + "VALUES (?, ?, ?, ?)",
            kind, success ? "SUCCESS" : "FAILURE", latencyMs, message);
    }

    /* ─── Access Point ──────────────────────────────────────────── */

    public AccessPointStatus loadAp() {
        final int clients = jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM der.network_client WHERE trust='APPROVED'",
            Integer.class);
        return jdbc.queryForObject(
            "SELECT * FROM der.network_access_point WHERE id = 1",
            (ResultSet rs, int row) -> new AccessPointStatus(
                rs.getBoolean("running"), rs.getBoolean("enabled"),
                rs.getString("interface_name"), rs.getString("ssid"),
                rs.getString("band"), rs.getInt("channel"),
                rs.getString("security_mode"), clients,
                rs.getBoolean("dhcp_active"), rs.getString("gateway"),
                rs.getString("subnet"), rs.getString("edge_id"),
                optInstant(rs.getTimestamp("started_at")),
                optInstant(rs.getTimestamp("network_key_rotated_at"))));
    }

    public void setApRunning(final boolean running) {
        jdbc.update(
            "UPDATE der.network_access_point SET running=?, "
          + "  started_at = CASE WHEN ? THEN now() ELSE started_at END, "
          + "  stopped_at = CASE WHEN ? THEN NULL ELSE now() END, "
          + "  dhcp_active=?, updated_at=now() WHERE id=1",
            running, running, running, running);
    }

    public void rotateApKey(final String hash) {
        jdbc.update(
            "UPDATE der.network_access_point SET network_key_hash=?, "
          + "       network_key_rotated_at=now(), updated_at=now() WHERE id=1",
            hash);
    }

    /* ─── Interfaces + routes ───────────────────────────────────── */

    public List<NetworkInterface> listInterfaces() {
        return jdbc.query(
            "SELECT * FROM der.network_interface ORDER BY priority ASC, name",
            interfaceMapper());
    }

    public Optional<NetworkInterface> findInterface(final String name) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                "SELECT * FROM der.network_interface WHERE name=?",
                interfaceMapper(), name));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public int setInterfaceState(final String name, final InterfaceState state) {
        return jdbc.update(
            "UPDATE der.network_interface SET state=?, "
          + "       administrative_up = (?::text = 'up'), updated_at=now() "
          + "WHERE name=?",
            state.name(), state.name(), name);
    }

    public List<NetworkRoute> listRoutes() {
        return jdbc.query(
            "SELECT * FROM der.network_route WHERE active=TRUE ORDER BY metric ASC",
            (ResultSet rs, int row) -> new NetworkRoute(
                (UUID) rs.getObject("id"), rs.getString("destination"),
                rs.getString("gateway"), rs.getString("interface_name"),
                rs.getInt("metric"), rs.getString("source"),
                rs.getBoolean("active")));
    }

    /* ─── Clients + events ──────────────────────────────────────── */

    public List<NetworkClient> listClients() {
        return jdbc.query(
            "SELECT * FROM der.network_client ORDER BY last_seen_at DESC",
            clientMapper());
    }

    public Optional<NetworkClient> findClient(final String deviceId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                "SELECT * FROM der.network_client WHERE device_id=?",
                clientMapper(), deviceId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /** Idempotent upsert — a device that scans the QR + hits the
     *  enrolment endpoint lands as PENDING on first contact and
     *  refreshes its last-seen on subsequent heartbeats. */
    public NetworkClient upsertEnrol(final String deviceId, final String owner,
                                        final String hostname, final String ip,
                                        final String mac, final ClientLink link,
                                        final String certFingerprint) {
        jdbc.update(
            "INSERT INTO der.network_client "
          + "(device_id, owner, hostname, ip, mac, link, trust, "
          + " certificate_fingerprint, first_seen_at, last_seen_at) "
          + "VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, now(), now()) "
          + "ON CONFLICT (device_id) DO UPDATE SET "
          + "  last_seen_at = now(), "
          + "  ip = EXCLUDED.ip, "
          + "  mac = COALESCE(EXCLUDED.mac, der.network_client.mac), "
          + "  hostname = COALESCE(EXCLUDED.hostname, der.network_client.hostname), "
          + "  owner = COALESCE(EXCLUDED.owner, der.network_client.owner), "
          + "  certificate_fingerprint = COALESCE(EXCLUDED.certificate_fingerprint, "
          + "                                      der.network_client.certificate_fingerprint)",
            deviceId, owner, hostname, ip, mac, link.name(), certFingerprint);
        return findClient(deviceId).orElseThrow(() ->
            new IllegalStateException("enrol row disappeared"));
    }

    public int upsertLease(final String mac, final String ip, final String hostname,
                             final long leaseSeconds, final boolean staticLease) {
        return jdbc.update(
            "INSERT INTO der.network_lease (mac, ip, hostname, expires_at, static_lease) "
          + "VALUES (?, ?, ?, now() + make_interval(secs => ?), ?) "
          + "ON CONFLICT (mac) DO UPDATE SET "
          + "  ip = EXCLUDED.ip, hostname = EXCLUDED.hostname, "
          + "  expires_at = EXCLUDED.expires_at, static_lease = EXCLUDED.static_lease",
            mac, ip, hostname, (double) leaseSeconds, staticLease);
    }

    public int clearStaleLeases() {
        return jdbc.update(
            "DELETE FROM der.network_lease "
          + "WHERE expires_at < now() AND NOT static_lease");
    }

    public int countLeases() {
        return jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM der.network_lease WHERE expires_at > now()",
            Integer.class);
    }

    public List<Map<String, Object>> listLeases() {
        return jdbc.query(
            "SELECT mac, ip, hostname, issued_at, expires_at, static_lease "
          + "  FROM der.network_lease WHERE expires_at > now() "
          + "  ORDER BY expires_at DESC",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("mac",       rs.getString("mac"));
                m.put("ip",        rs.getString("ip"));
                m.put("hostname",  rs.getString("hostname"));
                m.put("issuedAt",  optInstant(rs.getTimestamp("issued_at")));
                m.put("expiresAt", optInstant(rs.getTimestamp("expires_at")));
                m.put("staticLease", rs.getBoolean("static_lease"));
                return m;
            });
    }

    /* ─── Phase N4 — WAN failover ───────────────────────────────── */

    /** Find the current active default-route interface (lowest-metric
     *  active row whose destination is 0.0.0.0/0). Returns null if
     *  no default route is active. */
    public String currentDefaultIface() {
        try {
            return jdbc.queryForObject(
                "SELECT interface_name FROM der.network_route "
              + "  WHERE destination='0.0.0.0/0' AND active=TRUE "
              + "  ORDER BY metric ASC LIMIT 1",
                String.class);
        } catch (final org.springframework.dao.EmptyResultDataAccessException e) {
            return null;
        }
    }

    /** Pick the WAN-worthy interface with the lowest priority value
     *  (lowest = highest preference) that is currently up. Returns
     *  null if no interface qualifies. */
    public Optional<NetworkInterface> pickWanCandidate() {
        try {
            final NetworkInterface n = jdbc.queryForObject(
                "SELECT * FROM der.network_interface "
              + "  WHERE state='up' AND administrative_up=TRUE "
              + "    AND purpose IN ('facility-lan','upstream-wifi','cellular-fallback') "
              + "  ORDER BY priority ASC LIMIT 1",
                interfaceMapper());
            return Optional.ofNullable(n);
        } catch (final org.springframework.dao.EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public int promoteDefaultRoute(final String iface, final String gateway) {
        jdbc.update("UPDATE der.network_route SET active=FALSE WHERE destination='0.0.0.0/0'");
        return jdbc.update(
            "INSERT INTO der.network_route (destination, gateway, interface_name, "
          + "                                 metric, source, active) "
          + "  VALUES ('0.0.0.0/0', ?, ?, 100, 'DYNAMIC', TRUE) "
          + "  ON CONFLICT DO NOTHING",
            gateway, iface);
    }

    public int deactivateDefaultRoute() {
        return jdbc.update(
            "UPDATE der.network_route SET active=FALSE WHERE destination='0.0.0.0/0'");
    }

    /* ─── Phase N2 — enrolment tokens ──────────────────────────── */

    public void insertEnrolToken(final String tokenHash, final UUID issuedBy,
                                   final java.time.Instant expiresAt,
                                   final String deviceIdHint) {
        jdbc.update(
            "INSERT INTO der.network_enrol_token "
          + "(token_hash, issued_by, expires_at, device_id_hint) "
          + "VALUES (?, ?, ?, ?)",
            tokenHash, issuedBy, Timestamp.from(expiresAt), deviceIdHint);
    }

    /** Returns true if the token is valid + unconsumed, and marks it
     *  consumed by {@code deviceId} atomically. */
    public boolean consumeEnrolToken(final String tokenHash, final String deviceId) {
        return jdbc.update(
            "UPDATE der.network_enrol_token "
          + "   SET consumed_at=now(), consumed_by_device=? "
          + " WHERE token_hash=? AND consumed_at IS NULL "
          + "   AND expires_at > now()",
            deviceId, tokenHash) > 0;
    }

    public List<Map<String, Object>> listEnrolTokens() {
        return jdbc.query(
            "SELECT issued_at, expires_at, device_id_hint, consumed_at, consumed_by_device "
          + "  FROM der.network_enrol_token "
          + "  ORDER BY issued_at DESC LIMIT 100",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("issuedAt",   optInstant(rs.getTimestamp("issued_at")));
                m.put("expiresAt",  optInstant(rs.getTimestamp("expires_at")));
                m.put("deviceIdHint", rs.getString("device_id_hint"));
                m.put("consumedAt", optInstant(rs.getTimestamp("consumed_at")));
                m.put("consumedBy", rs.getString("consumed_by_device"));
                return m;
            });
    }

    public int updateClientTrust(final String deviceId, final ClientTrust trust,
                                   final UUID actor) {
        if (trust == ClientTrust.APPROVED) {
            return jdbc.update(
                "UPDATE der.network_client SET trust='APPROVED', "
              + "       approved_by=?, approved_at=now(), revoked_at=NULL "
              + "WHERE device_id=?", actor, deviceId);
        }
        if (trust == ClientTrust.REVOKED) {
            return jdbc.update(
                "UPDATE der.network_client SET trust='REVOKED', revoked_at=now() "
              + "WHERE device_id=?", deviceId);
        }
        return jdbc.update(
            "UPDATE der.network_client SET trust=? WHERE device_id=?",
            trust.name(), deviceId);
    }

    public List<NetworkEvent> listEvents(final int limit) {
        return jdbc.query(
            "SELECT * FROM der.network_event ORDER BY observed_at DESC LIMIT ?",
            eventMapper(), Math.max(1, Math.min(limit, 500)));
    }

    public int clearEvents() {
        return jdbc.update("DELETE FROM der.network_event");
    }

    public void recordEvent(final String type, final String outcome,
                              final String deviceId, final String nodeId,
                              final String interfaceName, final String actor,
                              final String reason, final String correlationId) {
        jdbc.update(
            "INSERT INTO der.network_event "
          + "(event_type, outcome, device_id, node_id, interface_name, actor, reason, correlation_id) "
          + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            type, outcome, deviceId, nodeId, interfaceName, actor, reason, correlationId);
    }

    /* ─── Peers (Phase N5) ──────────────────────────────────────── */

    public List<NetworkPeer> listPeers() {
        return jdbc.query(
            "SELECT * FROM der.network_peer ORDER BY added_at DESC",
            peerMapper());
    }

    public Optional<NetworkPeer> findPeer(final UUID id) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                "SELECT * FROM der.network_peer WHERE id=?",
                peerMapper(), id));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public int setPeerState(final UUID id, final PeerState state) {
        return jdbc.update(
            "UPDATE der.network_peer SET state=?, "
          + "       last_handshake = CASE WHEN ?::text = 'CONNECTED' THEN now() "
          + "                              ELSE last_handshake END "
          + "WHERE id=?", state.name(), state.name(), id);
    }

    public int deletePeer(final UUID id) {
        return jdbc.update("DELETE FROM der.network_peer WHERE id=?", id);
    }

    public UUID insertPeer(final String nodeId, final String siteId, final String endpoint,
                             final String publicKey, final String allowedIps,
                             final UUID addedBy) {
        final UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO der.network_peer "
          + "(id, node_id, site_id, endpoint, public_key, allowed_ips, "
          + " state, trust, added_by) "
          + "VALUES (?, ?, ?, ?, ?, ?, 'DISCONNECTED', 'UNVERIFIED', ?)",
            id, nodeId, siteId, endpoint, publicKey, allowedIps, addedBy);
        return id;
    }

    /* ─── Firewall policy ───────────────────────────────────────── */

    public List<PolicyRule> listRules() {
        return jdbc.query(
            "SELECT * FROM der.network_policy_rule ORDER BY position ASC",
            (ResultSet rs, int row) -> new PolicyRule(
                (UUID) rs.getObject("id"), rs.getInt("position"),
                rs.getString("source_zone"), rs.getString("destination_zone"),
                PolicyAction.valueOf(rs.getString("action")),
                rs.getString("note"),
                optInstant(rs.getTimestamp("updated_at"))));
    }

    public UUID insertRule(final int position, final String src, final String dst,
                             final PolicyAction action, final String note, final UUID actor) {
        final UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO der.network_policy_rule "
          + "(id, position, source_zone, destination_zone, action, note, updated_by) "
          + "VALUES (?, ?, ?, ?, ?, ?, ?)",
            id, position, src, dst, action.name(), note, actor);
        return id;
    }

    public int updateRule(final UUID id, final PolicyAction action, final String note,
                            final UUID actor) {
        return jdbc.update(
            "UPDATE der.network_policy_rule SET action=?, note=?, "
          + "       updated_by=?, updated_at=now() WHERE id=?",
            action.name(), note, actor, id);
    }

    /** Full-record update — used by the Edit rule dialog. Null fields
     *  are preserved (so operators can tweak just one field at a time). */
    public int editRule(final UUID id, final Integer position, final String src,
                          final String dst, final PolicyAction action,
                          final String note, final UUID actor) {
        return jdbc.update(
            "UPDATE der.network_policy_rule SET "
          + "  position         = COALESCE(?, position), "
          + "  source_zone      = COALESCE(?, source_zone), "
          + "  destination_zone = COALESCE(?, destination_zone), "
          + "  action           = COALESCE(?, action), "
          + "  note             = COALESCE(?, note), "
          + "  updated_by = ?, updated_at = now() "
          + "WHERE id = ?",
            position, src, dst, action == null ? null : action.name(),
            note, actor, id);
    }

    /* ─── AP + client + interface + peer config edits (2.1.91) ──── */

    public int updateApConfig(final String ssid, final String band, final Integer channel,
                                 final String security, final String interfaceName,
                                 final String gateway, final String subnet) {
        return jdbc.update(
            "UPDATE der.network_access_point SET "
          + "  ssid           = COALESCE(?, ssid), "
          + "  band           = COALESCE(?, band), "
          + "  channel        = COALESCE(?, channel), "
          + "  security_mode  = COALESCE(?, security_mode), "
          + "  interface_name = COALESCE(?, interface_name), "
          + "  gateway        = COALESCE(?, gateway), "
          + "  subnet         = COALESCE(?, subnet), "
          + "  updated_at     = now() WHERE id = 1",
            ssid, band, channel, security, interfaceName, gateway, subnet);
    }

    public int updateClientLabel(final String deviceId, final String owner,
                                    final String hostname) {
        return jdbc.update(
            "UPDATE der.network_client SET "
          + "  owner    = COALESCE(?, owner), "
          + "  hostname = COALESCE(?, hostname) "
          + "WHERE device_id = ?",
            owner, hostname, deviceId);
    }

    public int updateInterfaceConfig(final String name, final Integer priority,
                                        final String purpose) {
        return jdbc.update(
            "UPDATE der.network_interface SET "
          + "  priority = COALESCE(?, priority), "
          + "  purpose  = COALESCE(?, purpose), "
          + "  updated_at = now() "
          + "WHERE name = ?",
            priority, purpose, name);
    }

    public int updatePeerConfig(final UUID id, final String nodeId, final String siteId,
                                   final String endpoint, final String publicKey,
                                   final String allowedIps) {
        return jdbc.update(
            "UPDATE der.network_peer SET "
          + "  node_id     = COALESCE(?, node_id), "
          + "  site_id     = COALESCE(?, site_id), "
          + "  endpoint    = COALESCE(?, endpoint), "
          + "  public_key  = COALESCE(?, public_key), "
          + "  allowed_ips = COALESCE(?, allowed_ips) "
          + "WHERE id = ?",
            nodeId, siteId, endpoint, publicKey, allowedIps, id);
    }

    public int deleteRule(final UUID id) {
        return jdbc.update("DELETE FROM der.network_policy_rule WHERE id=?", id);
    }

    /* ─── Settings ──────────────────────────────────────────────── */

    public Map<String, String> loadSettings() {
        final Map<String, String> out = new LinkedHashMap<>();
        jdbc.query("SELECT key, value FROM der.network_settings ORDER BY key",
                   (ResultSet rs) -> {
                       out.put(rs.getString("key"), rs.getString("value"));
                   });
        return out;
    }

    public int putSetting(final String key, final String value) {
        return jdbc.update(
            "INSERT INTO der.network_settings (key, value, updated_at) "
          + "VALUES (?, ?, now()) ON CONFLICT (key) DO UPDATE "
          + "SET value = EXCLUDED.value, updated_at = now()",
            key, value);
    }

    /* ─── Mappers ───────────────────────────────────────────────── */

    private RowMapper<NetworkInterface> interfaceMapper() {
        return (ResultSet rs, int row) -> new NetworkInterface(
            rs.getString("name"),
            InterfaceKind.valueOf(rs.getString("kind")),
            InterfaceState.valueOf(rs.getString("state")),
            InterfacePurpose.fromWire(rs.getString("purpose")),
            rs.getString("address"), rs.getString("mac"),
            optLong(rs, "rx_bytes"), optLong(rs, "tx_bytes"),
            rs.getString("link_speed"), rs.getInt("priority"));
    }

    private RowMapper<NetworkClient> clientMapper() {
        return (ResultSet rs, int row) -> new NetworkClient(
            rs.getString("device_id"), (UUID) rs.getObject("der_device_id"),
            rs.getString("owner"), rs.getString("hostname"),
            rs.getString("ip"), rs.getString("mac"),
            ClientLink.valueOf(rs.getString("link")),
            optInt(rs, "signal_dbm"),
            ClientTrust.valueOf(rs.getString("trust")),
            rs.getString("certificate_fingerprint"),
            optLong(rs, "bytes_tx"), optLong(rs, "bytes_rx"),
            optInstant(rs.getTimestamp("first_seen_at")),
            optInstant(rs.getTimestamp("last_seen_at")),
            (UUID) rs.getObject("approved_by"),
            optInstant(rs.getTimestamp("approved_at")),
            optInstant(rs.getTimestamp("revoked_at")));
    }

    private RowMapper<NetworkEvent> eventMapper() {
        return (ResultSet rs, int row) -> new NetworkEvent(
            (UUID) rs.getObject("event_id"), rs.getString("event_type"),
            rs.getString("outcome"), rs.getString("device_id"),
            rs.getString("node_id"), rs.getString("interface_name"),
            rs.getString("actor"), rs.getString("reason"),
            rs.getString("correlation_id"),
            optInstant(rs.getTimestamp("observed_at")));
    }

    private RowMapper<NetworkPeer> peerMapper() {
        return (ResultSet rs, int row) -> new NetworkPeer(
            (UUID) rs.getObject("id"), rs.getString("node_id"),
            rs.getString("site_id"), rs.getString("endpoint"),
            rs.getString("public_key"), rs.getString("allowed_ips"),
            PeerState.valueOf(rs.getString("state")),
            PeerTrust.valueOf(rs.getString("trust")),
            optLong(rs, "rx_bytes"), optLong(rs, "tx_bytes"),
            optInstant(rs.getTimestamp("last_handshake")),
            optInstant(rs.getTimestamp("added_at")));
    }

    private static Instant optInstant(final Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
    private static Integer optInt(final ResultSet rs, final String col)
            throws java.sql.SQLException {
        final int v = rs.getInt(col);
        return rs.wasNull() ? null : v;
    }
    private static Long optLong(final ResultSet rs, final String col)
            throws java.sql.SQLException {
        final long v = rs.getLong(col);
        return rs.wasNull() ? null : v;
    }

    @SuppressWarnings("unused")
    private List<String> unused() {
        return new ArrayList<>();
    }
}
