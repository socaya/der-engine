package ug.ac.mak.der.workflows.aggregate;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Row in {@code der.operation_journal}. Phase 03.5 writes PENDING entries;
 * Phase 04 drains them. ADR-0027 adds the optional
 * {@code nextHopOrgUnitUid} for chain-via-hub referrals.
 */
public record OperationJournalEntry(
        UUID operationId,
        EntityType entityType,
        String entityRef,
        JsonNode payload,
        State state,
        int attemptCount,
        String lastError,
        UUID submittedBy,
        Instant createdAt,
        Instant updatedAt,
        String nextHopOrgUnitUid
) {

    public OperationJournalEntry(final UUID operationId, final EntityType entityType,
                                   final String entityRef, final JsonNode payload,
                                   final State state, final int attemptCount,
                                   final String lastError, final UUID submittedBy,
                                   final Instant createdAt, final Instant updatedAt) {
        this(operationId, entityType, entityRef, payload, state, attemptCount,
                lastError, submittedBy, createdAt, updatedAt, null);
    }

    public OperationJournalEntry {
        Objects.requireNonNull(operationId, "operationId");
        Objects.requireNonNull(entityType, "entityType");
        Objects.requireNonNull(entityRef, "entityRef");
        Objects.requireNonNull(payload, "payload");
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (attemptCount < 0) {
            throw new IllegalArgumentException("attemptCount must be >= 0");
        }
    }

    public enum EntityType {
        AGGREGATE_DATA_VALUE,
        EVENT,
        TRACKED_ENTITY,
        ENROLLMENT,
        PROGRAM_STAGE_EVENT
    }

    public enum State {
        PENDING,
        IN_FLIGHT,
        CENTRAL_ACCEPTED,
        CENTRAL_REJECTED,
        RETRYABLE,
        UNKNOWN_OUTCOME,
        CONFLICT_REVIEW
    }
}
