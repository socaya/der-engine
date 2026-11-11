package ug.ac.mak.der.analytics.column.governor;

import java.util.UUID;

/**
 * Thrown by {@link QueryToken#throwIfAborted} when a running
 * query must stop — admin cancel, deadline exceeded, or memory
 * ceiling crossed. Propagated by every operator that honours the
 * token so partial state is always cleaned up (SRS FR-QRY-013).
 */
public final class QueryAbortedException extends RuntimeException {

    private final UUID queryId;

    public QueryAbortedException(final UUID queryId,
                                   final String message) {
        super(message);
        this.queryId = queryId;
    }

    public UUID queryId() {
        return queryId;
    }
}
