package ug.ac.mak.der.workflows.aggregate;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Repository for {@code der.operation_journal}. Phase 03.5 only inserts
 * PENDING rows alongside the actual business write; Phase 04 adds the
 * worker that transitions states and the backlog queries.
 */
@Repository
public class OperationJournalRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public OperationJournalRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    public OperationJournalEntry insert(final OperationJournalEntry entry) {
        jdbc.update(
                "INSERT INTO der.operation_journal "
                        + "(operation_id, entity_type, entity_ref, payload_json, state, "
                        + " attempt_count, last_error, submitted_by, created_at, updated_at, "
                        + " next_hop_org_unit_uid) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), ?, ?, ?, ?, ?, ?, ?)",
                entry.operationId(),
                entry.entityType().name(),
                entry.entityRef(),
                writeJson(entry.payload()),
                entry.state().name(),
                entry.attemptCount(),
                entry.lastError(),
                entry.submittedBy(),
                Timestamp.from(entry.createdAt()),
                Timestamp.from(entry.updatedAt()),
                entry.nextHopOrgUnitUid()
        );
        return entry;
    }

    public Optional<OperationJournalEntry> findById(final UUID operationId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
                            + "attempt_count, last_error, submitted_by, created_at, updated_at "
                            + "FROM der.operation_journal WHERE operation_id = ?",
                    rowMapper(),
                    operationId
            ));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<OperationJournalEntry> findPending(final int limit) {
        return findByState(OperationJournalEntry.State.PENDING, limit);
    }

    /**
     * Returns {@code state=PENDING} rows that are ready to be drained —
     * i.e. either do not require approval, or have been approved. Rows
     * that have been rejected locally are excluded. ADR-0016.
     */
    public List<OperationJournalEntry> findPendingReadyToDrain(final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        // FR-12-03 dependency-ordered batching: an op whose supersedes
        // target is still PENDING (or IN_FLIGHT) must wait so central
        // sees the ordering intended at commit time.
        return jdbc.query(
                "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
                        + "attempt_count, last_error, submitted_by, created_at, updated_at, "
                        + "next_hop_org_unit_uid "
                        + "FROM der.operation_journal oj "
                        + "WHERE state = 'PENDING' "
                        + "  AND (requires_approval = FALSE OR approved_at IS NOT NULL) "
                        + "  AND rejected_at IS NULL "
                        + "  AND (supersedes IS NULL OR NOT EXISTS ("
                        + "        SELECT 1 FROM der.operation_journal p "
                        + "         WHERE p.operation_id = oj.supersedes "
                        + "           AND p.state IN ('PENDING', 'IN_FLIGHT', 'RETRYABLE', 'UNKNOWN_OUTCOME'))) "
                        + "ORDER BY created_at ASC LIMIT ?",
                rowMapper(), capped);
    }

    /**
     * Phase 10 (ADR-0016): mark a brand-new journal row as requiring
     * approval before the worker is allowed to drain it. Call once right
     * after {@link #insert} when the write service decides approval
     * is required.
     */
    public int markRequiresApproval(final UUID operationId) {
        return jdbc.update(
                "UPDATE der.operation_journal SET requires_approval = TRUE "
                        + "WHERE operation_id = ?", operationId);
    }

    /**
     * FR-09-10 journal retention. Deletes rows in a terminal state
     * (CENTRAL_ACCEPTED, CENTRAL_REJECTED) older than the cutoff.
     * Returns the number of rows purged. Operator-driven via
     * `/edge-api/v1/admin/ops/journal/purge?olderThanDays=`.
     */
    public int purgeTerminalBefore(final Instant cutoff) {
        Objects.requireNonNull(cutoff, "cutoff");
        return jdbc.update(
                "DELETE FROM der.operation_journal "
                        + "WHERE state IN ('CENTRAL_ACCEPTED','CENTRAL_REJECTED') "
                        + "  AND updated_at < ?",
                Timestamp.from(cutoff));
    }

    public List<OperationJournalEntry> findByState(final OperationJournalEntry.State state,
                                                    final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        return jdbc.query(
                "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
                        + "attempt_count, last_error, submitted_by, created_at, updated_at, "
                        + "next_hop_org_unit_uid "
                        + "FROM der.operation_journal WHERE state = ? "
                        + "ORDER BY created_at ASC LIMIT ?",
                rowMapper(),
                state.name(),
                capped
        );
    }

    public int countByState(final OperationJournalEntry.State state) {
        final Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.operation_journal WHERE state = ?",
                Integer.class,
                state.name()
        );
        return n == null ? 0 : n;
    }

    private String writeJson(final JsonNode node) {
        try {
            return json.writeValueAsString(node);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialise journal payload", ex);
        }
    }

    private JsonNode readJson(final String raw) {
        try {
            return json.readTree(raw);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to parse journal payload", ex);
        }
    }

    public int markNextHop(final UUID operationId, final String nextHopOrgUnitUid) {
        Objects.requireNonNull(operationId, "operationId");
        return jdbc.update(
                "UPDATE der.operation_journal SET next_hop_org_unit_uid = ?, updated_at = now() "
                        + "WHERE operation_id = ?",
                nextHopOrgUnitUid, operationId);
    }

    private RowMapper<OperationJournalEntry> rowMapper() {
        return (ResultSet rs, int rowNum) -> new OperationJournalEntry(
                rs.getObject("operation_id", UUID.class),
                OperationJournalEntry.EntityType.valueOf(rs.getString("entity_type")),
                rs.getString("entity_ref"),
                readJson(rs.getString("payload_json")),
                OperationJournalEntry.State.valueOf(rs.getString("state")),
                rs.getInt("attempt_count"),
                rs.getString("last_error"),
                rs.getObject("submitted_by", UUID.class),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant(),
                rs.getString("next_hop_org_unit_uid")
        );
    }
}
