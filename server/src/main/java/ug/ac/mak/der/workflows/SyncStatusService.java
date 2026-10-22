package ug.ac.mak.der.workflows;

import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;

import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;

/**
 * Per-record sync status probe.
 *
 * <p>Phase 03.5 extends the Phase 03 placeholder: when
 * {@code entityType=aggregate_data_value} and the id resolves to a row in
 * {@code aggregate_data_value}, DER returns
 * {@link SyncStatus#LOCALLY_COMMITTED}; otherwise {@link SyncStatus#UNKNOWN}.
 * Phase 04 extends this to {@code PENDING_CENTRAL}, {@code CENTRAL_ACCEPTED},
 * {@code CONFLICT_REVIEW} as the journal worker makes progress.</p>
 */
@Service
public class SyncStatusService {

    static final String TYPE_AGGREGATE = "aggregate_data_value";

    private final AggregateDataValueRepository aggregates;

    public SyncStatusService(final AggregateDataValueRepository aggregates) {
        this.aggregates = Objects.requireNonNull(aggregates, "aggregates");
    }

    public SyncStatusResponse statusFor(final String entityType, final String entityId) {
        if (entityType == null || entityType.isBlank() || entityId == null || entityId.isBlank()) {
            throw new IllegalArgumentException("entityType and entityId must not be blank");
        }
        if (TYPE_AGGREGATE.equals(entityType)) {
            final UUID id = tryParseUuid(entityId);
            if (id != null && aggregates.existsById(id)) {
                return new SyncStatusResponse(entityType, entityId, SyncStatus.LOCALLY_COMMITTED,
                        "Local write recorded. Phase 04 journal worker will push and transition this to "
                                + "PENDING_CENTRAL / CENTRAL_ACCEPTED.");
            }
        }
        return new SyncStatusResponse(entityType, entityId, SyncStatus.UNKNOWN,
                "No local record and no journal match. Trigger a submission or wait for Phase 04 journal integration.");
    }

    private static UUID tryParseUuid(final String s) {
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException ex) {
            return null;
        }
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
