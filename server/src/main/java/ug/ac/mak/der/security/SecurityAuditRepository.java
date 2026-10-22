package ug.ac.mak.der.security;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Objects;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Append-only writer for {@code security_audit}. Reads happen in Phase 06. */
@Repository
public class SecurityAuditRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public SecurityAuditRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

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
