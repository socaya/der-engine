package ug.ac.mak.der.security;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Append-only writer for {@code security_audit}. The row's hash chain
 * ({@code prev_hash}, {@code row_hash}) is populated by the Postgres
 * BEFORE INSERT trigger installed by V017 (ADR-0021) — the Java path
 * only writes the business columns.
 */
@Repository
public class SecurityAuditRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public SecurityAuditRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    /** C2: list audit events, optionally filtered by event type and/or actor. */
    public List<Row> findRecent(final String eventType, final UUID actorUserId, final int limit) {
        final int cap = Math.min(Math.max(1, limit), 500);
        final StringBuilder sql = new StringBuilder(
                "SELECT event_type, actor_user_id, subject_user_id, client_ip::text AS client_ip, "
                        + "user_agent, outcome, detail::text AS detail, observed_at "
                        + "FROM der.security_audit WHERE 1=1");
        final java.util.List<Object> args = new java.util.ArrayList<>();
        if (eventType != null && !eventType.isBlank()) {
            sql.append(" AND event_type = ?");
            args.add(eventType);
        }
        if (actorUserId != null) {
            sql.append(" AND actor_user_id = ?");
            args.add(actorUserId);
        }
        sql.append(" ORDER BY observed_at DESC LIMIT ?");
        args.add(cap);
        return jdbc.query(sql.toString(), rowMapper(), args.toArray());
    }

    private static RowMapper<Row> rowMapper() {
        return (ResultSet rs, int n) -> new Row(
                rs.getString("event_type"),
                rs.getObject("actor_user_id", UUID.class),
                rs.getObject("subject_user_id", UUID.class),
                rs.getString("client_ip"),
                rs.getString("user_agent"),
                rs.getString("outcome"),
                rs.getString("detail"),
                rs.getTimestamp("observed_at").toInstant());
    }

    public record Row(String eventType, UUID actorUserId, UUID subjectUserId,
                        String clientIp, String userAgent, String outcome,
                        String detailJson, Instant observedAt) { }

    public void append(final AuditEvent event, final Instant observedAt) {
        final String detail;
        try {
            detail = json.writeValueAsString(event.detail());
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialise audit detail", ex);
        }
        jdbc.update(
                "INSERT INTO der.security_audit "
                        + "(event_type, actor_user_id, subject_user_id, client_ip, user_agent, outcome, detail, observed_at) "
                        + "VALUES (?, ?, ?, CAST(? AS inet), ?, ?, CAST(? AS jsonb), ?)",
                event.eventType(),
                event.actorUserId(),
                event.subjectUserId(),
                event.clientIp(),
                event.userAgent(),
                event.outcome().name(),
                detail,
                Timestamp.from(observedAt)
        );
    }
}
