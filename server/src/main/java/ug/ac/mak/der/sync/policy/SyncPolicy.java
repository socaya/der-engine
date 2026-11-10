package ug.ac.mak.der.sync.policy;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A single sync-policy row. {@link #scope} is either {@code
 * "GLOBAL"} or the name of an {@link
 * ug.ac.mak.der.workflows.aggregate.OperationJournalEntry.EntityType}.
 */
public record SyncPolicy(
        String scope,
        SyncPolicyMode mode,
        String scheduleCron,
        String pausedReason,
        UUID updatedBy,
        Instant updatedAt
) {

    public SyncPolicy {
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(mode, "mode");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (mode == SyncPolicyMode.SCHEDULED
                && (scheduleCron == null || scheduleCron.isBlank())) {
            throw new IllegalArgumentException(
                    "SCHEDULED mode requires a cron expression");
        }
        if (mode == SyncPolicyMode.PAUSED
                && (pausedReason == null || pausedReason.isBlank())) {
            throw new IllegalArgumentException(
                    "PAUSED mode requires a reason");
        }
    }
}
