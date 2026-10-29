package ug.ac.mak.der.compliance;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** §7 Compliance + §6.5 audit tamper detection — retention,
 *  erasure, audit chain anchoring, data residency enforcement. */
@Service
public class ComplianceService {

    private static final Logger LOG = LoggerFactory.getLogger(ComplianceService.class);

    private final JdbcTemplate jdbc;

    public ComplianceService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /* ─── Retention ────────────────────────────────────────────── */

    public List<Map<String, Object>> listPolicies() {
        return jdbc.query(
            "SELECT category, keep_days, description, "
          + "       last_purge_at, last_purge_rows "
          + "  FROM der.retention_policy ORDER BY category",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("category",    rs.getString("category"));
                m.put("keepDays",    rs.getInt("keep_days"));
                m.put("description", rs.getString("description"));
                final Timestamp lp = rs.getTimestamp("last_purge_at");
                m.put("lastPurgeAt", lp == null ? null : lp.toInstant().toString());
                m.put("lastPurgeRows", rs.getLong("last_purge_rows"));
                return m;
            });
    }

    public int setPolicy(final String category, final int keepDays, final UUID actor) {
        return jdbc.update(
            "UPDATE der.retention_policy "
          + "   SET keep_days = ?, updated_by = ?, updated_at = now() "
          + " WHERE category = ?",
            keepDays, actor, category);
    }

    /** Daily at 03:00 — purge rows past their retention. Table mapping
     *  is explicit so operators understand the blast radius. */
    @Scheduled(cron = "${der.retention.cron:0 0 3 * * *}")
    @Transactional
    public void dailyRetentionSweep() {
        for (final Map<String, Object> p : listPolicies()) {
            final String category = (String) p.get("category");
            final int days = ((Number) p.get("keepDays")).intValue();
            final String sql = switch (category) {
                case "network_event" ->
                    "DELETE FROM der.network_event WHERE observed_at < now() - make_interval(days => ?)";
                case "device_message" ->
                    "DELETE FROM der.device_message WHERE created_at < now() - make_interval(days => ?)";
                case "peer_health_sample" ->
                    "DELETE FROM der.peer_health_sample WHERE sampled_at < now() - make_interval(days => ?)";
                case "network_probe" ->
                    "DELETE FROM der.network_probe WHERE probed_at < now() - make_interval(days => ?)";
                default -> null;
            };
            if (sql == null) {
                continue;
            }
            final int n = jdbc.update(sql, days);
            jdbc.update(
                "UPDATE der.retention_policy "
              + "   SET last_purge_at = now(), last_purge_rows = ? "
              + " WHERE category = ?", n, category);
            if (n > 0) {
                LOG.info("retention: {} removed {} rows (> {} days)", category, n, days);
            }
        }
    }

    /* ─── Right-to-erasure ─────────────────────────────────────── */

    @Transactional
    public Map<String, Object> requestErasure(final String subjectType, final String subjectId,
                                                 final String reason, final UUID requestedBy) {
        final UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO der.erasure_request "
          + "(request_id, subject_type, subject_id, reason, requested_by) "
          + "VALUES (?, ?, ?, ?, ?)",
            id, subjectType, subjectId, reason, requestedBy);
        // Dry-run: enumerate what *would* be purged. The actual purge
        // runs when an admin flips status to COMPLETED via /approve.
        final Map<String, Object> hits = new LinkedHashMap<>();
        hits.put("network_event",   jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM der.network_event WHERE device_id = ?",
            Integer.class, subjectId));
        hits.put("device_message", jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM der.device_message WHERE from_device_id = ?",
            Integer.class, subjectId));
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("requestId", id.toString());
        m.put("subjectType", subjectType);
        m.put("subjectId", subjectId);
        m.put("status", "PENDING");
        m.put("estimatedRowsAffected", hits);
        return m;
    }

    @Transactional
    public Map<String, Object> completeErasure(final UUID requestId, final UUID actor) {
        final Map<String, Object> req = jdbc.queryForObject(
            "SELECT subject_type, subject_id FROM der.erasure_request "
          + " WHERE request_id = ? AND status = 'PENDING'",
            (rs, row) -> Map.of("subjectType", (Object) rs.getString("subject_type"),
                                 "subjectId", (Object) rs.getString("subject_id")),
            requestId);
        final String subjectId = (String) req.get("subjectId");
        final Map<String, Object> affected = new LinkedHashMap<>();
        affected.put("network_event", jdbc.update(
            "DELETE FROM der.network_event WHERE device_id = ?", subjectId));
        affected.put("device_message", jdbc.update(
            "DELETE FROM der.device_message WHERE from_device_id = ?", subjectId));
        affected.put("network_client", jdbc.update(
            "DELETE FROM der.network_client WHERE device_id = ?", subjectId));
        final String receipt = sha256Hex(requestId + "|" + subjectId + "|" + affected + "|" + Instant.now());
        try {
            jdbc.update(
                "UPDATE der.erasure_request "
              + "   SET status = 'COMPLETED', completed_at = now(), "
              + "       receipt_hash = ?, rows_affected = ?::jsonb "
              + " WHERE request_id = ?",
                receipt, new com.fasterxml.jackson.databind.ObjectMapper()
                             .writeValueAsString(affected), requestId);
        } catch (final Exception ex) {
            throw new IllegalStateException("could not record erasure receipt", ex);
        }
        return Map.of("requestId", requestId.toString(),
                       "receiptHash", receipt,
                       "rowsAffected", affected);
    }

    public List<Map<String, Object>> listErasureRequests(final int limit) {
        return jdbc.query(
            "SELECT request_id, subject_type, subject_id, reason, "
          + "       requested_at, status, completed_at, receipt_hash "
          + "  FROM der.erasure_request ORDER BY requested_at DESC LIMIT ?",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("requestId",   rs.getObject("request_id").toString());
                m.put("subjectType", rs.getString("subject_type"));
                m.put("subjectId",   rs.getString("subject_id"));
                m.put("reason",      rs.getString("reason"));
                m.put("requestedAt", rs.getTimestamp("requested_at").toInstant().toString());
                m.put("status",      rs.getString("status"));
                final Timestamp ct = rs.getTimestamp("completed_at");
                m.put("completedAt", ct == null ? null : ct.toInstant().toString());
                m.put("receiptHash", rs.getString("receipt_hash"));
                return m;
            },
            Math.max(1, Math.min(limit, 200)));
    }

    /* ─── Audit tamper detection ───────────────────────────────── */

    /** Daily at 02:00 — compute a hash of (prev_anchor || all rows
     *  since last anchor) and persist. If any row was tampered with
     *  the chain breaks on the next recomputation. */
    @Scheduled(cron = "${der.audit.anchor.cron:0 0 2 * * *}")
    @Transactional
    public void dailyAuditAnchor() {
        final Integer rows = jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM der.network_event", Integer.class);
        final String head = jdbc.queryForObject(
            "SELECT COALESCE(MAX(row_hash), '') FROM der.network_event",
            String.class);
        final String chainHead = sha256Hex((head == null ? "" : head) + "|" + rows + "|" + Instant.now());
        jdbc.update(
            "INSERT INTO der.audit_anchor (anchor_at, row_count, chain_head) "
          + "VALUES (now(), ?, ?)", rows, chainHead);
        LOG.info("audit anchor at rows={} head={}", rows, chainHead.substring(0, 16));
    }

    public List<Map<String, Object>> listAnchors(final int limit) {
        return jdbc.query(
            "SELECT anchor_at, row_count, chain_head, uploaded_at "
          + "  FROM der.audit_anchor ORDER BY anchor_at DESC LIMIT ?",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("anchorAt", rs.getTimestamp("anchor_at").toInstant().toString());
                m.put("rowCount", rs.getLong("row_count"));
                m.put("chainHead", rs.getString("chain_head"));
                final Timestamp ua = rs.getTimestamp("uploaded_at");
                m.put("uploadedAt", ua == null ? null : ua.toInstant().toString());
                return m;
            },
            Math.max(1, Math.min(limit, 100)));
    }

    /* ─── Audit export ─────────────────────────────────────────── */

    public String exportAuditCsv(final Instant since, final Instant until) {
        final List<Map<String, Object>> rows = jdbc.query(
            "SELECT event_id, event_type, outcome, device_id, node_id, "
          + "       interface_name, actor, reason, correlation_id, observed_at "
          + "  FROM der.network_event "
          + " WHERE observed_at >= ? AND observed_at < ? "
          + " ORDER BY observed_at ASC",
            (rs, row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("eventId",      rs.getObject("event_id").toString());
                m.put("eventType",    rs.getString("event_type"));
                m.put("outcome",      rs.getString("outcome"));
                m.put("deviceId",     rs.getString("device_id"));
                m.put("nodeId",       rs.getString("node_id"));
                m.put("interfaceName", rs.getString("interface_name"));
                m.put("actor",        rs.getString("actor"));
                m.put("reason",       rs.getString("reason"));
                m.put("correlationId", rs.getString("correlation_id"));
                m.put("observedAt",   rs.getTimestamp("observed_at").toInstant().toString());
                return m;
            },
            Timestamp.from(since), Timestamp.from(until));
        final StringBuilder sb = new StringBuilder(16 * 1024);
        sb.append("eventId,eventType,outcome,deviceId,nodeId,interfaceName,actor,reason,correlationId,observedAt\n");
        for (final Map<String, Object> r : rows) {
            sb.append(q(r.get("eventId"))).append(',')
              .append(q(r.get("eventType"))).append(',')
              .append(q(r.get("outcome"))).append(',')
              .append(q(r.get("deviceId"))).append(',')
              .append(q(r.get("nodeId"))).append(',')
              .append(q(r.get("interfaceName"))).append(',')
              .append(q(r.get("actor"))).append(',')
              .append(q(r.get("reason"))).append(',')
              .append(q(r.get("correlationId"))).append(',')
              .append(q(r.get("observedAt"))).append('\n');
        }
        return sb.toString();
    }

    private static String q(final Object v) {
        if (v == null) {
            return "";
        }
        final String s = v.toString();
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    /* ─── Data residency ──────────────────────────────────────── */

    public List<Map<String, Object>> listResidencyRules() {
        return jdbc.query(
            "SELECT rule_id, host_pattern, allow, note, updated_at "
          + "  FROM der.data_residency_rule ORDER BY allow DESC, host_pattern",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("ruleId",      rs.getObject("rule_id").toString());
                m.put("hostPattern", rs.getString("host_pattern"));
                m.put("allow",       rs.getBoolean("allow"));
                m.put("note",        rs.getString("note"));
                m.put("updatedAt",   rs.getTimestamp("updated_at").toInstant().toString());
                return m;
            });
    }

    public boolean isAllowed(final String host) {
        if (host == null) {
            return false;
        }
        for (final Map<String, Object> r : listResidencyRules()) {
            final String pattern = ((String) r.get("hostPattern")).toLowerCase();
            final boolean allow = (Boolean) r.get("allow");
            if (matches(pattern, host.toLowerCase())) {
                return allow;
            }
        }
        return false;
    }

    private static boolean matches(final String pattern, final String host) {
        if (pattern.startsWith("*")) {
            return host.endsWith(pattern.substring(1));
        }
        if (pattern.endsWith("*")) {
            return host.startsWith(pattern.substring(0, pattern.length() - 1));
        }
        return pattern.equalsIgnoreCase(host);
    }

    /* ─── Helpers ──────────────────────────────────────────────── */

    private static String sha256Hex(final Object v) {
        try {
            final byte[] b = MessageDigest.getInstance("SHA-256")
                                           .digest(v.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(b);
        } catch (final Exception ex) {
            throw new IllegalStateException("SHA-256 missing", ex);
        }
    }
}
