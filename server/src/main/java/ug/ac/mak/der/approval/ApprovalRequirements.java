package ug.ac.mak.der.approval;

import java.util.Objects;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

/**
 * Reads the per-domain approval-required config. ADR-0016.
 */
@Component
public class ApprovalRequirements {

    private final boolean requireAggregate;
    private final boolean requireEvent;
    private final boolean requireTracker;

    public ApprovalRequirements(
            @Value("${der.approval.require.aggregate:false}") final boolean requireAggregate,
            @Value("${der.approval.require.event:false}") final boolean requireEvent,
            @Value("${der.approval.require.tracker:false}") final boolean requireTracker) {
        this.requireAggregate = requireAggregate;
        this.requireEvent = requireEvent;
        this.requireTracker = requireTracker;
    }

    public boolean requiresApproval(final OperationJournalEntry.EntityType type) {
        Objects.requireNonNull(type, "type");
        return switch (type) {
            case AGGREGATE_DATA_VALUE -> requireAggregate;
            case EVENT, PROGRAM_STAGE_EVENT -> requireEvent;
            case TRACKED_ENTITY, ENROLLMENT -> requireTracker;
        };
    }

    public boolean requireAggregate() {
        return requireAggregate;
    }

    public boolean requireEvent() {
        return requireEvent;
    }

    public boolean requireTracker() {
        return requireTracker;
    }
}
