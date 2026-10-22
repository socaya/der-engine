package ug.ac.mak.der.workflows;

import java.sql.ResultSet;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

/**
 * Phase 03 recent-activity feed for the device client's "Recent work" screen
 * (DC-04). Reads from the {@code security_audit} table so the user sees the
 * same actions the audit log sees — nothing is fabricated.
 *
 * <p>Only events relevant to end-user workflow steps are surfaced:
 * {@code SIGN_IN_SUCCESS}, {@code USER_CREATED} (when the acting user is the
 * subject). Phase 04 will populate a dedicated {@code workflow_activity}
 * table once the journal lands.</p>
 */
@Service
public class ActivityService {

    static final List<String> SURFACED_EVENT_TYPES = List.of(
            "SIGN_IN_SUCCESS",
            "USER_CREATED",
            "WORKFLOW_APP_LAUNCHED"
    );

    private final JdbcTemplate jdbc;

    public ActivityService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public List<ActivityEntry> recentForUser(final UUID userId, final int limit) {
        final int capped = Math.max(1, Math.min(limit, 100));
        return jdbc.query(
                "SELECT audit_id, event_type, outcome, observed_at "
                        + "FROM der.security_audit "
                        + "WHERE actor_user_id = ? "
                        + "AND event_type = ANY (?) "
                        + "ORDER BY observed_at DESC LIMIT ?",
                rowMapper(),
                userId,
                SURFACED_EVENT_TYPES.toArray(new String[0]),
                capped
        );
    }

    private static RowMapper<ActivityEntry> rowMapper() {
        return (ResultSet rs, int rowNum) -> new ActivityEntry(
                rs.getLong("audit_id"),
                rs.getString("event_type"),
                rs.getString("outcome"),
                rs.getTimestamp("observed_at").toInstant()
        );
    }

    /** Row rendered on DC-04 Recent work. */
    public record ActivityEntry(long auditId, String eventType, String outcome, Instant observedAt) {
        public ActivityEntry {
            if (eventType == null || outcome == null || observedAt == null) {
                throw new IllegalArgumentException("eventType/outcome/observedAt must not be null");
            }
        }
    }
}
