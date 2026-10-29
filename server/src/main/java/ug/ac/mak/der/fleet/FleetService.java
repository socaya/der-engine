package ug.ac.mak.der.fleet;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.network.NetworkCaService;
import ug.ac.mak.der.network.NetworkEntities.NetworkPeer;
import ug.ac.mak.der.network.NetworkRepository;

/** §8 Multi-edge fleet view.
 *
 *  <p>Each edge keeps a local roster of every edge it knows about
 *  (itself + peers). The roster is auto-populated from
 *  {@link NetworkCaService#fingerprint()} + the peer_adjacency table
 *  + the peer_health_sample table. The admin UI's fleet dashboard
 *  reads this roster so it works even without a central inventory
 *  service.</p>
 */
@Service
public class FleetService {

    private final JdbcTemplate jdbc;
    private final NetworkCaService ca;
    private final NetworkRepository networkRepo;

    public FleetService(final JdbcTemplate jdbc, final NetworkCaService ca,
                          final NetworkRepository networkRepo) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.ca = Objects.requireNonNull(ca, "ca");
        this.networkRepo = Objects.requireNonNull(networkRepo, "networkRepo");
    }

    /** Refresh the local roster every 5 min: upsert self + each peer. */
    @Scheduled(fixedDelayString = "${der.fleet.refreshInterval:300000}",
               initialDelayString = "${der.fleet.initialDelay:30000}")
    public void refreshRoster() {
        ca.ensureCa();
        upsertSelf();
        for (final NetworkPeer p : networkRepo.listPeers()) {
            upsertPeer(p);
        }
    }

    private void upsertSelf() {
        jdbc.update(
            "INSERT INTO der.edge_fleet_entry "
          + "(edge_id, role, display_name, announced_version) "
          + "VALUES (?, 'self', ?, ?) "
          + "ON CONFLICT (edge_id) DO UPDATE SET "
          + "  last_seen_at = now(), "
          + "  display_name = COALESCE(der.edge_fleet_entry.display_name, EXCLUDED.display_name), "
          + "  announced_version = EXCLUDED.announced_version",
            ca.fingerprint(), "this edge", version());
    }

    private void upsertPeer(final NetworkPeer p) {
        final String edgeId = p.nodeId() == null ? p.id().toString() : p.nodeId();
        jdbc.update(
            "INSERT INTO der.edge_fleet_entry "
          + "(edge_id, role, display_name, site_id) "
          + "VALUES (?, 'peer', ?, ?) "
          + "ON CONFLICT (edge_id) DO UPDATE SET "
          + "  last_seen_at = now(), "
          + "  display_name = COALESCE(der.edge_fleet_entry.display_name, EXCLUDED.display_name), "
          + "  site_id = COALESCE(EXCLUDED.site_id, der.edge_fleet_entry.site_id)",
            edgeId, p.nodeId(), p.siteId());
    }

    private String version() {
        final Package pkg = getClass().getPackage();
        final String v = pkg == null ? null : pkg.getImplementationVersion();
        return v == null ? "dev" : v;
    }

    /* ─── Admin surface ────────────────────────────────────────── */

    public List<Map<String, Object>> listFleet() {
        return jdbc.query(
            "SELECT edge_id, display_name, site_id, role, first_seen_at, "
          + "       last_seen_at, announced_version, tags::text AS tags "
          + "  FROM der.edge_fleet_entry ORDER BY role DESC, last_seen_at DESC",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("edgeId",       rs.getString("edge_id"));
                m.put("displayName",  rs.getString("display_name"));
                m.put("siteId",       rs.getString("site_id"));
                m.put("role",         rs.getString("role"));
                m.put("firstSeenAt",  rs.getTimestamp("first_seen_at").toInstant().toString());
                m.put("lastSeenAt",   rs.getTimestamp("last_seen_at").toInstant().toString());
                m.put("announcedVersion", rs.getString("announced_version"));
                m.put("tags",         rs.getString("tags"));
                return m;
            });
    }

    public Map<String, Object> summary() {
        final Map<String, Object> m = new LinkedHashMap<>();
        try {
            final Timestamp latestHealth = jdbc.queryForObject(
                "SELECT MAX(sampled_at) FROM der.peer_health_sample",
                Timestamp.class);
            m.put("latestHealthProbeAt",
                   latestHealth == null ? null : latestHealth.toInstant().toString());
            m.put("edgeCount", jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM der.edge_fleet_entry", Integer.class));
            m.put("peerCount", jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM der.network_peer", Integer.class));
            m.put("peersUp24h", jdbc.queryForObject(
                "SELECT COUNT(DISTINCT peer_id)::int "
              + "  FROM der.peer_health_sample "
              + " WHERE outcome = 'UP' "
              + "   AND sampled_at > now() - interval '24 hours'",
                Integer.class));
        } catch (final Exception ignored) {
            // table may be empty on first boot
        }
        m.put("self", Map.of("edgeId", ca.fingerprint()));
        return m;
    }

    public List<Map<String, Object>> perPeerHealth() {
        return jdbc.query(
            "SELECT p.id AS peer_id, p.node_id, p.endpoint, p.state, p.trust, "
          + "       (SELECT outcome FROM der.peer_health_sample s "
          + "         WHERE s.peer_id = p.id ORDER BY sampled_at DESC LIMIT 1) AS last_outcome, "
          + "       (SELECT latency_ms FROM der.peer_health_sample s "
          + "         WHERE s.peer_id = p.id AND latency_ms IS NOT NULL "
          + "         ORDER BY sampled_at DESC LIMIT 1) AS last_latency_ms, "
          + "       (SELECT remote_version FROM der.peer_health_sample s "
          + "         WHERE s.peer_id = p.id AND remote_version IS NOT NULL "
          + "         ORDER BY sampled_at DESC LIMIT 1) AS remote_version, "
          + "       (SELECT COUNT(*) FROM der.peer_health_sample s "
          + "         WHERE s.peer_id = p.id "
          + "           AND s.sampled_at > now() - interval '24 hours') AS samples_24h, "
          + "       (SELECT COUNT(*) FROM der.peer_health_sample s "
          + "         WHERE s.peer_id = p.id AND outcome = 'UP' "
          + "           AND s.sampled_at > now() - interval '24 hours') AS up_24h "
          + "  FROM der.network_peer p ORDER BY p.added_at DESC",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("peerId",   rs.getObject("peer_id").toString());
                m.put("nodeId",   rs.getString("node_id"));
                m.put("endpoint", rs.getString("endpoint"));
                m.put("state",    rs.getString("state"));
                m.put("trust",    rs.getString("trust"));
                m.put("lastOutcome",   rs.getString("last_outcome"));
                final int ll = rs.getInt("last_latency_ms");
                m.put("lastLatencyMs", rs.wasNull() ? null : ll);
                m.put("remoteVersion", rs.getString("remote_version"));
                final long s24 = rs.getLong("samples_24h");
                final long u24 = rs.getLong("up_24h");
                m.put("samples24h", s24);
                m.put("up24h", u24);
                m.put("uptime24h", s24 == 0 ? null
                                    : Math.round(100.0 * u24 / s24));
                return m;
            });
    }
}
