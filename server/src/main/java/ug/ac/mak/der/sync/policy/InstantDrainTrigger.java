package ug.ac.mak.der.sync.policy;

import java.util.Objects;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.journal.JournalWorker;

/**
 * SM-2 — INSTANT-mode drain scheduler. Called by
 * {@link ug.ac.mak.der.workflows.aggregate.OperationJournalRepository}
 * right after a new row is inserted. When the effective policy for
 * that entity type is {@link SyncPolicyMode#INSTANT} the trigger
 * schedules a drain tick ~200 ms in the future, cancelling any
 * previously-scheduled pending tick so a burst of writes coalesces
 * into a single drain rather than one per write.
 *
 * <p>Non-blocking: the write path returns immediately; the drain
 * runs on the shared daemon executor. If the policy resolves to
 * SCHEDULED or PAUSED the trigger is a no-op — the Quartz cron and
 * the PAUSED filter inside {@link JournalWorker#drainBatch} take
 * over.</p>
 *
 * <p>Uses {@link ObjectProvider} for the worker dependency so a
 * cycle (worker → repository → trigger → worker) doesn't block Spring
 * startup.</p>
 */
@Component
public class InstantDrainTrigger {

    private static final Logger LOG = LoggerFactory.getLogger(InstantDrainTrigger.class);
    private static final long DEBOUNCE_MILLIS = 200L;

    private final SyncPolicyService policy;
    private final ObjectProvider<JournalWorker> workerProvider;
    private final ScheduledExecutorService executor;
    private final AtomicReference<ScheduledFuture<?>> pending =
            new AtomicReference<>(null);

    public InstantDrainTrigger(final SyncPolicyService policy,
                                 final ObjectProvider<JournalWorker> workerProvider,
                                 final ScheduledExecutorService
                                         instantDrainExecutor) {
        this.policy = Objects.requireNonNull(policy, "policy");
        this.workerProvider =
                Objects.requireNonNull(workerProvider, "workerProvider");
        this.executor =
                Objects.requireNonNull(instantDrainExecutor, "executor");
    }

    public void onWrite(final OperationJournalEntry.EntityType type) {
        if (type == null) {
            return;
        }
        if (policy.effectiveFor(type).mode() != SyncPolicyMode.INSTANT) {
            return;
        }
        final ScheduledFuture<?> prior = pending.getAndSet(null);
        if (prior != null && !prior.isDone()) {
            prior.cancel(false);
        }
        final ScheduledFuture<?> next = executor.schedule(
                this::safeDrain, DEBOUNCE_MILLIS, TimeUnit.MILLISECONDS);
        pending.set(next);
    }

    private void safeDrain() {
        try {
            final JournalWorker worker = workerProvider.getIfAvailable();
            if (worker == null) {
                return;
            }
            worker.drainBatch();
        } catch (RuntimeException ex) {
            LOG.warn("instant drain failed: {}", ex.getMessage());
        } finally {
            pending.set(null);
        }
    }
}
