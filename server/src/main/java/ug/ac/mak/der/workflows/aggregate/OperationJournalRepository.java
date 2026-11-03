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
                        + " next_hop_org_unit_uid, workflow_run_id) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), ?, ?, ?, ?, ?, ?, ?, ?)",
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
                entry.nextHopOrgUnitUid(),
                entry.workflowRunId()
        );
        return entry;
    }

    /** Returns [entity_type, state, count] rows for the backlog breakdown
     *  used by the sync overview "by data type" table. */
    public List<EntityStateCount> countByEntityTypeAndState() {
        return jdbc.query(
                "SELECT entity_type, state, COUNT(*)::int AS c "
                        + "FROM der.operation_journal "
                        + "GROUP BY entity_type, state",
                (rs, i) -> new EntityStateCount(
                        rs.getString("entity_type"),
                        rs.getString("state"),
                        rs.getInt("c")));
    }

    /** Projection row for {@link #countByEntityTypeAndState()}. */
    public record EntityStateCount(String entityType, String state, int count) { }

    public Optional<OperationJournalEntry> findById(final UUID operationId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    // §2.3.119 R-AP — the rowMapper reads workflow_run_id;
                    // the SELECT was missing it, so queryForObject failed
                    // with BadSqlGrammarException on every GET
                    // /journal/operations/{opId} lookup (visible in the
                    // UI as a 404 "Record not found · invalid credentials").
                    "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
                            + "attempt_count, last_error, submitted_by, created_at, updated_at, "
                            + "next_hop_org_unit_uid, workflow_run_id "
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
                        + "next_hop_org_unit_uid, workflow_run_id "
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
     * FR-05-10/11: move a drift-affected entry to CONFLICT_REVIEW so
     * the drain worker does not re-attempt it. Caller supplies the
     * drift summary; it is persisted on {@code last_error} so operators
     * can see the specific missing refs via the admin API.
     */
    public int quarantine(final UUID operationId, final String reason) {
        Objects.requireNonNull(operationId, "operationId");
        return jdbc.update(
                "UPDATE der.operation_journal SET state = 'CONFLICT_REVIEW', "
                        + "last_error = ?, updated_at = now() "
                        + "WHERE operation_id = ?",
                reason, operationId);
    }

    /** §2.3.105 R-Y — bulk force-retry by operation id. Used by the
     *  per-stream retry button inside the TEI payload-lineage drawer
     *  where the admin targets specific operation ids rather than a
     *  whole workflow run. Semantics match {@link #requeuePending}
     *  per row. */
    public int requeuePendingByIds(final List<UUID> operationIds) {
        Objects.requireNonNull(operationIds, "operationIds");
        if (operationIds.isEmpty()) {
            return 0;
        }
        final String placeholders = operationIds.stream()
                .map(id -> "?").reduce((a, b) -> a + "," + b).orElse("?");
        final Object[] args = operationIds.toArray();
        return jdbc.update(
                "UPDATE der.operation_journal "
              + "SET state = 'PENDING', last_error = NULL, updated_at = now() "
              + "WHERE operation_id IN (" + placeholders + ") "
              + "  AND state IN ('RETRYABLE','CENTRAL_REJECTED','CONFLICT_REVIEW',"
              + "                 'QUARANTINED','UNKNOWN_OUTCOME')",
                args);
    }

    /** §2.3.103 R-T — bulk force-retry for a workflow run, optionally
     *  scoped to a set of states. Returns the number of rows moved
     *  back to PENDING. Semantics match {@link #requeuePending} per
     *  row (preserve attempt_count, clear last_error, only touch
     *  non-terminal non-pending states). */
    public int requeuePendingByRun(final UUID workflowRunId,
                                     final List<String> states) {
        Objects.requireNonNull(workflowRunId, "workflowRunId");
        final List<String> defaulted = (states == null || states.isEmpty())
                ? List.of("RETRYABLE","CENTRAL_REJECTED","CONFLICT_REVIEW",
                          "QUARANTINED","UNKNOWN_OUTCOME")
                : states;
        final String placeholders = defaulted.stream()
                .map(s -> "?").reduce((a, b) -> a + "," + b).orElse("?");
        final Object[] args = new Object[1 + defaulted.size()];
        args[0] = workflowRunId;
        for (int i = 0; i < defaulted.size(); i++) {
            args[i + 1] = defaulted.get(i);
        }
        return jdbc.update(
                "UPDATE der.operation_journal "
              + "SET state = 'PENDING', last_error = NULL, updated_at = now() "
              + "WHERE workflow_run_id = ? "
              + "  AND state IN (" + placeholders + ")",
                args);
    }

    /** §2.3.102 R-Q — force-retry a single operation.
     *
     *  Resets {@code state} to {@code PENDING} and clears {@code
     *  last_error} so the next drain tick picks the row up again.
     *  Attempt count is preserved so operators can see how many times
     *  the row has already been through the sync worker (useful when
     *  debugging whack-a-mole conflicts). */
    public int requeuePending(final UUID operationId) {
        Objects.requireNonNull(operationId, "operationId");
        return jdbc.update(
                "UPDATE der.operation_journal "
              + "SET state = 'PENDING', last_error = NULL, updated_at = now() "
              + "WHERE operation_id = ? "
              + "  AND state IN ('RETRYABLE','CENTRAL_REJECTED','CONFLICT_REVIEW',"
              + "                 'QUARANTINED','UNKNOWN_OUTCOME')",
                operationId);
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

    /** Return recent operations across any subset of states — powers the
     *  /sync/data table in the admin UI (DER Sync requirements §7). */
    public List<OperationJournalEntry> findRecent(final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        return jdbc.query(
                "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
                        + "attempt_count, last_error, submitted_by, created_at, updated_at, "
                        + "next_hop_org_unit_uid, workflow_run_id "
                        + "FROM der.operation_journal "
                        + "ORDER BY updated_at DESC LIMIT ?",
                rowMapper(),
                capped);
    }

    public List<OperationJournalEntry> findByState(final OperationJournalEntry.State state,
                                                    final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        return jdbc.query(
                "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
                        + "attempt_count, last_error, submitted_by, created_at, updated_at, "
                        + "next_hop_org_unit_uid, workflow_run_id "
                        + "FROM der.operation_journal WHERE state = ? "
                        + "ORDER BY created_at ASC LIMIT ?",
                rowMapper(),
                state.name(),
                capped
        );
    }

    /**
     * ADR-0034 — the latest journal row for a given
     * (entity_type, entity_ref) pair. The inbound-pull merger uses
     * the result's state to pick between "overwrite" (terminal
     * local row) and "raise conflict" (non-terminal local row).
     */
    public Optional<OperationJournalEntry> findLatestByEntityRef(
            final OperationJournalEntry.EntityType entityType, final String entityRef) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
                            + "attempt_count, last_error, submitted_by, created_at, updated_at, "
                            + "next_hop_org_unit_uid, workflow_run_id "
                            + "FROM der.operation_journal "
                            + "WHERE entity_type = ? AND entity_ref = ? "
                            + "ORDER BY updated_at DESC LIMIT 1",
                    rowMapper(),
                    entityType.name(), entityRef));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
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

    /**
     * Phase 10.3 — ADR-0027 D-RHO-4 referral ack. Stamps the row's
     * {@code referral_delivered_at} + {@code referral_receipt_id} iff
     * the row is actually a referral (next_hop set) AND hasn't been
     * acked yet. Returns the number of rows updated (0 or 1) so
     * callers can distinguish "ok, delivered just now" from "already
     * delivered" / "not a referral".
     */
    public int markReferralDelivered(final UUID operationId, final String receiptId,
                                        final Instant deliveredAt) {
        Objects.requireNonNull(operationId, "operationId");
        return jdbc.update(
                "UPDATE der.operation_journal "
                        + "SET referral_delivered_at = ?, "
                        + "    referral_receipt_id = ?, "
                        + "    updated_at = now() "
                        + "WHERE operation_id = ? "
                        + "  AND next_hop_org_unit_uid IS NOT NULL "
                        + "  AND referral_delivered_at IS NULL",
                java.sql.Timestamp.from(deliveredAt == null ? Instant.now() : deliveredAt),
                receiptId == null || receiptId.isBlank() ? null : receiptId.trim(),
                operationId);
    }

    /**
     * Phase 10.3.2 — rows picked up by the referral escalation
     * scanner. A row is "past due" when the next_hop was set and
     * the row hasn't been acked in {@code threshold}. Rows already
     * escalated are excluded so the job alerts at most once per
     * row (narrower partial index backs this scan).
     *
     * <p>Returns a sliver of each row (just operation_id +
     * next_hop_org_unit_uid + updated_at) because the escalation
     * audit event doesn't need the full payload — keeps the
     * batch cheap for the scheduled job.</p>
     */
    public List<ReferralOutstandingRow> findOutstandingReferralsPastDue(
            final Instant olderThan, final int limit) {
        Objects.requireNonNull(olderThan, "olderThan");
        return jdbc.query(
                "SELECT operation_id, next_hop_org_unit_uid, updated_at "
                        + "FROM der.operation_journal "
                        + "WHERE next_hop_org_unit_uid IS NOT NULL "
                        + "  AND referral_delivered_at IS NULL "
                        + "  AND referral_escalated_at IS NULL "
                        + "  AND updated_at < ? "
                        + "ORDER BY updated_at ASC LIMIT ?",
                (ResultSet rs, int n) -> new ReferralOutstandingRow(
                        rs.getObject("operation_id", UUID.class),
                        rs.getString("next_hop_org_unit_uid"),
                        rs.getTimestamp("updated_at").toInstant()),
                java.sql.Timestamp.from(olderThan),
                Math.max(1, Math.min(limit, 500)));
    }

    /**
     * Phase 10.3.2 — flag the referral row as escalated so the next
     * scheduled scan skips it. Idempotent: a row already escalated
     * stays at its original escalation timestamp.
     */
    public int markReferralEscalated(final UUID operationId, final Instant at) {
        Objects.requireNonNull(operationId, "operationId");
        return jdbc.update(
                "UPDATE der.operation_journal "
                        + "SET referral_escalated_at = ?, updated_at = now() "
                        + "WHERE operation_id = ? "
                        + "  AND next_hop_org_unit_uid IS NOT NULL "
                        + "  AND referral_delivered_at IS NULL "
                        + "  AND referral_escalated_at IS NULL",
                java.sql.Timestamp.from(at == null ? Instant.now() : at),
                operationId);
    }

    /** Slim projection returned by
     *  {@link #findOutstandingReferralsPastDue(Instant, int)}. */
    public record ReferralOutstandingRow(UUID operationId, String nextHopOrgUnitUid,
                                            Instant updatedAt) { }

    /**
     * Phase 11.1 — boot-time reaper. Any row left in {@code IN_FLIGHT}
     * at startup is from a drain that DER killed before the state
     * machine completed (SIGKILL, host crash, container OOM).
     * Resets them back to {@code PENDING} with {@code attempt_count +
     * 1} and a {@code reaped} marker in {@code last_error} so
     * operators can see post-mortem which rows got requeued.
     *
     * <p>Returns the number of rows requeued — zero on every normal
     * startup, non-zero only after an abnormal termination. Called
     * exactly once per boot from
     * {@code JournalInFlightReaperRunner}; the drain worker then
     * picks the rows up on its next tick.</p>
     */
    public int requeueOrphanedInFlight() {
        return jdbc.update(
                "UPDATE der.operation_journal "
                        + "SET state = 'PENDING', "
                        + "    attempt_count = attempt_count + 1, "
                        + "    last_error = COALESCE(last_error || ' | ', '') "
                        + "        || 'reaped at ' || now() || ': DER restart during drain', "
                        + "    updated_at = now() "
                        + "WHERE state = 'IN_FLIGHT'");
    }

    /**
     * Phase 12.1 — continuous (runtime) reaper. The boot-time reaper
     * only catches rows stuck IN_FLIGHT by a crash. A row stuck
     * during steady-state (publisher thread died, DB tx hung, worker
     * paused and un-paused) stays IN_FLIGHT forever since the
     * drain's {@code WHERE state = 'PENDING'} scan never sees it.
     *
     * <p>This method requeues rows that have been IN_FLIGHT longer
     * than {@code olderThan}. Called from a scheduled job every N
     * minutes.</p>
     *
     * @param olderThan rows with updated_at &lt; this timestamp are reaped
     * @return number of rows requeued
     */
    public int requeueStuckInFlight(final Instant olderThan) {
        Objects.requireNonNull(olderThan, "olderThan");
        return jdbc.update(
                "UPDATE der.operation_journal "
                        + "SET state = 'PENDING', "
                        + "    attempt_count = attempt_count + 1, "
                        + "    last_error = COALESCE(last_error || ' | ', '') "
                        + "        || 'reaped at ' || now() || ': stuck in IN_FLIGHT past "
                        + "runtime threshold', "
                        + "    updated_at = now() "
                        + "WHERE state = 'IN_FLIGHT' AND updated_at < ?",
                java.sql.Timestamp.from(olderThan));
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
                rs.getString("next_hop_org_unit_uid"),
                rs.getObject("workflow_run_id", UUID.class)
        );
    }

    /** §2.3.85 — paged listing filtered by {@code workflow_run_id}.
     *  Null workflowRunId returns the most-recent entries unfiltered. */
    public List<OperationJournalEntry> findByWorkflowRun(final UUID workflowRunId,
                                                           final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        if (workflowRunId == null) {
            return findRecent(capped);
        }
        return jdbc.query(
                "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
              + "attempt_count, last_error, submitted_by, created_at, updated_at, "
              + "next_hop_org_unit_uid, workflow_run_id "
              + "FROM der.operation_journal "
              + "WHERE workflow_run_id = ? "
              + "ORDER BY created_at DESC LIMIT ?",
                rowMapper(), workflowRunId, capped);
    }
}
