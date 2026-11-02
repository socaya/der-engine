package ug.ac.mak.der.network;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Phase 08 — authoritative central reachability state.
 *
 * <p>Replaces the "advisory only" ping snapshot with a hysteresis
 * state machine. {@link #observe(boolean)} is called by every actor
 * that learns whether central is up (the UI-facing {@code /dhis2/ping}
 * endpoint, the compat refresh job, any publisher that gets a hard
 * network error) and the gate publishes a stable
 * {@link State REACHABLE | DEGRADED | OFFLINE} that the sync drain,
 * UI topbar, metrics and peer-import flows read from.</p>
 *
 * <h3>State transitions</h3>
 *
 * <pre>
 *                       success                        success
 *     REACHABLE ◀────────────────── DEGRADED ◀────────────────── OFFLINE
 *         │             fail           │          fail             ▲
 *         └───────────────────────────▶─────────────────────────────┘
 * </pre>
 *
 * <ul>
 *   <li>Each state flip requires <strong>two consecutive observations</strong>
 *     in the new direction. One success in OFFLINE lands us in DEGRADED
 *     (recovering), the next success in DEGRADED promotes to REACHABLE.
 *     Mirror on the way down.</li>
 *   <li>DEGRADED is the "something changed, waiting to see if it sticks"
 *     bucket — sync drains normally here (optimistic), but the UI shows
 *     the badge in the warning tone.</li>
 *   <li>OFFLINE is the only state that gates sync drain. {@link #shouldDrain()}
 *     returns {@code false} so the worker short-circuits before building
 *     a batch, preventing RETRYABLE churn when central is clearly down.</li>
 * </ul>
 *
 * <p>Initial state is {@link State#REACHABLE} — optimistic. The first
 * genuine failure during boot drops to DEGRADED and the second to
 * OFFLINE, so the gate stabilises quickly without needing an explicit
 * warm-up probe.</p>
 */
@Service
public class CentralReachabilityGate {

    private static final Logger LOG = LoggerFactory.getLogger(CentralReachabilityGate.class);

    public enum State {
        /** Central is answering probes; drain unimpeded. */
        REACHABLE,
        /** Last probe disagreed with the stable state; drain continues
         *  optimistically, UI shows the warning tone. */
        DEGRADED,
        /** Two consecutive failures. Drain is skipped; UI shows the
         *  offline tone; metrics tick {@code der_sync_drain_skipped_total{
         *  reason="unreachable"}}. */
        OFFLINE
    }

    public record Snapshot(State state, Instant since, int consecutiveSuccess,
                             int consecutiveFailure) { }

    private final Clock clock;
    private final AtomicReference<Snapshot> snap;

    public CentralReachabilityGate(final Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock");
        this.snap = new AtomicReference<>(
                new Snapshot(State.REACHABLE, Instant.now(clock), 0, 0));
    }

    /**
     * Record one probe outcome. Returns the new {@link Snapshot} so
     * callers can log the transition and ship a metric without a
     * second trip through {@link #current()}.
     */
    public Snapshot observe(final boolean reachable) {
        return snap.updateAndGet(prev -> advance(prev, reachable));
    }

    public Snapshot current() {
        return snap.get();
    }

    public State state() {
        return snap.get().state();
    }

    /**
     * The gate predicate the sync drain reads before building a
     * batch. OFFLINE short-circuits — anything else drains normally.
     */
    public boolean shouldDrain() {
        return snap.get().state() != State.OFFLINE;
    }

    private Snapshot advance(final Snapshot prev, final boolean reachable) {
        final int succ = reachable ? prev.consecutiveSuccess() + 1 : 0;
        final int fail = reachable ? 0 : prev.consecutiveFailure() + 1;
        final State next = decide(prev.state(), succ, fail);
        if (next != prev.state()) {
            LOG.info("central reachability {} -> {} (succ={}, fail={})",
                    prev.state(), next, succ, fail);
            return new Snapshot(next, Instant.now(clock), succ, fail);
        }
        return new Snapshot(prev.state(), prev.since(), succ, fail);
    }

    private static State decide(final State prev, final int succ, final int fail) {
        return switch (prev) {
            case REACHABLE -> fail >= 1 ? State.DEGRADED : State.REACHABLE;
            case DEGRADED  -> fail >= 1 ? State.OFFLINE
                              : succ >= 1 ? State.REACHABLE
                              : State.DEGRADED;
            case OFFLINE   -> succ >= 1 ? State.DEGRADED : State.OFFLINE;
        };
    }
}
