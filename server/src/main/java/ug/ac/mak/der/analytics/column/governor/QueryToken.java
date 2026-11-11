package ug.ac.mak.der.analytics.column.governor;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Per-query handle issued by {@link QueryGovernor}. Operators call
 * {@link #throwIfAborted} between batches; an abort signal (user
 * cancel, deadline passed, memory ceiling exceeded) raises a
 * {@link QueryAbortedException} that the engine propagates
 * cleanly.
 *
 * <p>Thread-safe — the cancellation flag and byte counters are
 * atomics so an admin cancel on one thread wins the race with the
 * executor on another.</p>
 */
public final class QueryToken {

    private final UUID queryId;
    private final Instant startedAt;
    private final long maxDurationMillis;
    private final long maxBytes;
    private final String principal;
    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    private final AtomicLong bytesAccounted = new AtomicLong(0L);
    private final AtomicReference<State> state =
            new AtomicReference<>(State.RUNNING);

    public QueryToken(final UUID queryId, final Instant startedAt,
                        final long maxDurationMillis,
                        final long maxBytes,
                        final String principal) {
        this.queryId = Objects.requireNonNull(queryId, "queryId");
        this.startedAt = Objects.requireNonNull(startedAt, "startedAt");
        this.maxDurationMillis = maxDurationMillis;
        this.maxBytes = maxBytes;
        this.principal = principal;
    }

    public enum State { RUNNING, COMPLETED, CANCELLED, DEADLINE_EXCEEDED,
            MEMORY_EXCEEDED, FAILED }

    public UUID queryId() {
        return queryId;
    }

    public Instant startedAt() {
        return startedAt;
    }

    public long bytesAccounted() {
        return bytesAccounted.get();
    }

    public long maxBytes() {
        return maxBytes;
    }

    public State state() {
        return state.get();
    }

    public String principal() {
        return principal;
    }

    /** Admin + unit-test hook to abort. Idempotent. */
    public void cancel() {
        if (cancelled.compareAndSet(false, true)) {
            state.compareAndSet(State.RUNNING, State.CANCELLED);
        }
    }

    /** Operators call this to accumulate decoded-batch bytes.
     *  Crossing {@link #maxBytes} trips the memory guard. */
    public void accountBytes(final long bytes) {
        final long now = bytesAccounted.addAndGet(bytes);
        if (now > maxBytes) {
            state.compareAndSet(State.RUNNING, State.MEMORY_EXCEEDED);
        }
    }

    public void complete() {
        state.compareAndSet(State.RUNNING, State.COMPLETED);
    }

    public void fail() {
        state.compareAndSet(State.RUNNING, State.FAILED);
    }

    /** Called at operator boundaries to check for abort. Returns
     *  silently when still running; raises when cancelled, over
     *  deadline or over memory. */
    public void throwIfAborted() {
        if (cancelled.get()) {
            state.compareAndSet(State.RUNNING, State.CANCELLED);
            throw new QueryAbortedException(queryId,
                    "query cancelled by admin");
        }
        if (state.get() == State.MEMORY_EXCEEDED) {
            throw new QueryAbortedException(queryId,
                    "query exceeded memory budget " + maxBytes
                  + " bytes (accounted " + bytesAccounted + ")");
        }
        final long elapsed = System.currentTimeMillis()
                - startedAt.toEpochMilli();
        if (elapsed > maxDurationMillis) {
            state.compareAndSet(State.RUNNING, State.DEADLINE_EXCEEDED);
            throw new QueryAbortedException(queryId,
                    "query exceeded deadline " + maxDurationMillis
                  + " ms (elapsed " + elapsed + ")");
        }
    }
}
