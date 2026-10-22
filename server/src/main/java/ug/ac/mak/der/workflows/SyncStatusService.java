package ug.ac.mak.der.workflows;

import org.springframework.stereotype.Service;

/**
 * Phase 03 placeholder for the per-record sync status.
 *
 * <p>At Phase 03 DER has no journal yet, so there is only ever one honest
 * answer: {@link SyncStatus#LOCALLY_COMMITTED} if the client just saved it,
 * and {@link SyncStatus#UNKNOWN} otherwise. Phase 04 wires in the real
 * journal and this service starts returning {@code PENDING_CENTRAL},
 * {@code CENTRAL_ACCEPTED}, {@code CONFLICT_REVIEW}, etc.</p>
 *
 * <p>This exists at Phase 03 so the client's status chrome has a stable
 * endpoint shape; FR-04-06 "unsupported operations distinct from temporary
 * failures" is satisfied by {@link SyncStatus#UNKNOWN} being explicit
 * rather than inferred from a 404.</p>
 */
@Service
public class SyncStatusService {

    public SyncStatusResponse statusFor(final String entityType, final String entityId) {
        // Entity-type/ID are kept in the signature so Phase 04 can key its
        // journal lookup without a controller signature change. For now they
        // are only validated and reflected back.
        if (entityType == null || entityType.isBlank() || entityId == null || entityId.isBlank()) {
            throw new IllegalArgumentException("entityType and entityId must not be blank");
        }
        return new SyncStatusResponse(entityType, entityId, SyncStatus.UNKNOWN,
                "Phase 03 does not yet track per-record sync state. Phase 04 journal fills this in.");
    }

    public enum SyncStatus {
        LOCALLY_COMMITTED,
        PENDING_CENTRAL,
        CENTRAL_ACCEPTED,
        CENTRAL_REJECTED,
        CONFLICT_REVIEW,
        UNKNOWN
    }

    public record SyncStatusResponse(String entityType, String entityId, SyncStatus status, String note) { }
}
