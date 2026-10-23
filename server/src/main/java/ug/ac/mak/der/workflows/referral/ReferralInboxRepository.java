package ug.ac.mak.der.workflows.referral;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** ADR-0027 persistence for the referral inbox. */
@Repository
@ConditionalOnBean(JdbcTemplate.class)
public class ReferralInboxRepository {

    private final JdbcTemplate jdbc;

    public ReferralInboxRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /**
     * Inserts the entry if (kind, source_ref) doesn't already exist.
     * Returns the number of rows actually inserted (0 or 1).
     */
    public int insertIfAbsent(final ReferralInboxEntry e) {
        Objects.requireNonNull(e, "e");
        return jdbc.update(
                "INSERT INTO der.referral_inbox "
                        + "(inbox_id, kind, source_ref, bound_org_unit, payload, "
                        + " discovered_at, status, resolved_by, resolved_at) "
                        + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?, ?) "
                        + "ON CONFLICT (kind, source_ref) DO NOTHING",
                e.inboxId(), e.kind().name(), e.sourceRef(), e.boundOrgUnit(),
                e.payloadJson(), Timestamp.from(e.discoveredAt()),
                e.status().name(), e.resolvedBy(),
                e.resolvedAt() == null ? null : Timestamp.from(e.resolvedAt()));
    }

    public java.util.Optional<ReferralInboxEntry> findById(final UUID inboxId) {
        if (inboxId == null) {
            return java.util.Optional.empty();
        }
        try {
            return java.util.Optional.ofNullable(jdbc.queryForObject(
                    "SELECT inbox_id, kind, source_ref, bound_org_unit, payload::text AS payload, "
                            + "discovered_at, status, resolved_by, resolved_at "
                            + "FROM der.referral_inbox WHERE inbox_id = ?",
                    mapper(), inboxId));
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            return java.util.Optional.empty();
        }
    }

    public List<ReferralInboxEntry> findPending(final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        return jdbc.query(
                "SELECT inbox_id, kind, source_ref, bound_org_unit, payload::text AS payload, "
                        + "discovered_at, status, resolved_by, resolved_at "
                        + "FROM der.referral_inbox WHERE status = 'PENDING' "
                        + "ORDER BY discovered_at DESC LIMIT ?",
                mapper(), capped);
    }

    public int markResolved(final UUID inboxId, final ReferralInboxEntry.Status status,
                              final UUID actor, final Instant at) {
        Objects.requireNonNull(inboxId, "inboxId");
        if (status != ReferralInboxEntry.Status.ACCEPTED
                && status != ReferralInboxEntry.Status.DISMISSED) {
            throw new IllegalArgumentException("resolve requires ACCEPTED or DISMISSED");
        }
        return jdbc.update(
                "UPDATE der.referral_inbox SET status = ?, resolved_by = ?, resolved_at = ? "
                        + "WHERE inbox_id = ? AND status = 'PENDING'",
                status.name(), actor, Timestamp.from(at), inboxId);
    }

    private RowMapper<ReferralInboxEntry> mapper() {
        return (ResultSet rs, int row) -> new ReferralInboxEntry(
                (UUID) rs.getObject("inbox_id"),
                ReferralInboxEntry.Kind.valueOf(rs.getString("kind")),
                rs.getString("source_ref"),
                rs.getString("bound_org_unit"),
                rs.getString("payload"),
                rs.getTimestamp("discovered_at").toInstant(),
                ReferralInboxEntry.Status.valueOf(rs.getString("status")),
                (UUID) rs.getObject("resolved_by"),
                rs.getTimestamp("resolved_at") == null ? null
                        : rs.getTimestamp("resolved_at").toInstant());
    }
}
