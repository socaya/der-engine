package ug.ac.mak.der.approval;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Reads + writes the approval columns on {@code operation_journal}
 * (ADR-0016). The journal entry record proper stays slim.
 */
@Repository
@ConditionalOnBean(JdbcTemplate.class)
public class ApprovalRepository {

    private final JdbcTemplate jdbc;

    public ApprovalRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Optional<ApprovalRecord> findById(final UUID operationId) {
        if (operationId == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT operation_id, requires_approval, approved_by, approved_at, "
                            + "rejected_by, rejected_at, rejection_reason "
                            + "FROM der.operation_journal WHERE operation_id = ?",
                    rowMapper(), operationId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<PendingApprovalRow> findAwaiting(final int limit) {
        final int capped = Math.max(1, Math.min(500, limit));
        return jdbc.query(
                "SELECT operation_id, entity_type, entity_ref, submitted_by, created_at "
                        + "FROM der.operation_journal "
                        + "WHERE state = 'PENDING' AND requires_approval = TRUE "
                        + "  AND approved_at IS NULL AND rejected_at IS NULL "
                        + "ORDER BY created_at ASC LIMIT ?",
                (ResultSet rs, int row) -> new PendingApprovalRow(
                        (UUID) rs.getObject("operation_id"),
                        rs.getString("entity_type"),
                        rs.getString("entity_ref"),
                        (UUID) rs.getObject("submitted_by"),
                        rs.getTimestamp("created_at").toInstant()),
                capped);
    }

    public int approve(final UUID operationId, final UUID actor) {
        Objects.requireNonNull(operationId, "operationId");
        Objects.requireNonNull(actor, "actor");
        return jdbc.update(
                "UPDATE der.operation_journal "
                        + "SET approved_by = ?, approved_at = now(), updated_at = now() "
                        + "WHERE operation_id = ? "
                        + "  AND requires_approval = TRUE "
                        + "  AND approved_at IS NULL AND rejected_at IS NULL",
                actor, operationId);
    }

    public int reject(final UUID operationId, final UUID actor, final String reason) {
        Objects.requireNonNull(operationId, "operationId");
        Objects.requireNonNull(actor, "actor");
        return jdbc.update(
                "UPDATE der.operation_journal "
                        + "SET rejected_by = ?, rejected_at = now(), rejection_reason = ?, "
                        + "    updated_at = now() "
                        + "WHERE operation_id = ? "
                        + "  AND requires_approval = TRUE "
                        + "  AND approved_at IS NULL AND rejected_at IS NULL",
                actor, reason, operationId);
    }

    public int countAwaiting() {
        final Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.operation_journal "
                        + "WHERE state = 'PENDING' AND requires_approval = TRUE "
                        + "  AND approved_at IS NULL AND rejected_at IS NULL",
                Integer.class);
        return n == null ? 0 : n;
    }

    private RowMapper<ApprovalRecord> rowMapper() {
        return (ResultSet rs, int row) -> new ApprovalRecord(
                (UUID) rs.getObject("operation_id"),
                rs.getBoolean("requires_approval"),
                (UUID) rs.getObject("approved_by"),
                optInstant(rs.getTimestamp("approved_at")),
                (UUID) rs.getObject("rejected_by"),
                optInstant(rs.getTimestamp("rejected_at")),
                rs.getString("rejection_reason"));
    }

    private static java.time.Instant optInstant(final Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    /** Projection returned by the pending-approval list — includes the
     *  minimum business metadata the admin UI needs. */
    public record PendingApprovalRow(
            UUID operationId,
            String entityType,
            String entityRef,
            UUID submittedBy,
            java.time.Instant createdAt
    ) { }
}
