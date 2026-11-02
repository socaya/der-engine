package ug.ac.mak.der.workflows.pull;

import java.time.Instant;
import java.util.Objects;

/** Row of {@code der.data_pull_cursor} — ADR-0034. */
public record DataPullCursor(
        EntityType entityType,
        String orgUnitUid,
        Instant lastPulledAt,
        String lastCursor,
        int consecutiveFailures,
        String lastError,
        Instant createdAt,
        Instant updatedAt
) {

    public DataPullCursor {
        Objects.requireNonNull(entityType, "entityType");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }

    /** The three cursor namespaces per ADR-0034. */
    public enum EntityType {
        /** {@code /api/dataValueSets} pulls. */
        AGGREGATE,
        /** {@code /api/events} pulls. */
        EVENT,
        /** {@code /api/tracker} pulls — rolls up TEI + enrolment +
         *  stage event under a single watermark so one central
         *  tracker tick advances the whole family consistently. */
        TRACKER
    }
}
