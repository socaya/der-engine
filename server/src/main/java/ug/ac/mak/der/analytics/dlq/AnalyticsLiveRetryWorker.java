package ug.ac.mak.der.analytics.dlq;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.analytics.engine.AnalyticsLiveIngester;

/**
 * Scheduled retry loop for the live-ingester DLQ (spec §4.1
 * AN-FR-053 resilient queue). Pulls due entries, re-invokes the
 * ingester, and either removes the row on success or applies the
 * next step of the exponential backoff schedule.
 *
 * <p>Schedule (attempt → delay before next try):</p>
 * <table>
 *   <tr><td>1</td><td>1 min</td></tr>
 *   <tr><td>2</td><td>5 min</td></tr>
 *   <tr><td>3</td><td>30 min</td></tr>
 *   <tr><td>4</td><td>2 h</td></tr>
 *   <tr><td>5</td><td>12 h</td></tr>
 *   <tr><td>6+</td><td>gave_up — operator action required</td></tr>
 * </table>
 */
@Component
public class AnalyticsLiveRetryWorker {

    private static final Logger LOG =
            LoggerFactory.getLogger(AnalyticsLiveRetryWorker.class);

    /** Backoff ceiling — after this many failed attempts the entry
     *  is marked gave_up and stays in the table for operator
     *  review. 5 attempts covers a 14-ish-hour outage window. */
    static final int MAX_ATTEMPTS = 5;

    private static final Duration[] BACKOFF = {
        Duration.ofMinutes(1),
        Duration.ofMinutes(5),
        Duration.ofMinutes(30),
        Duration.ofHours(2),
        Duration.ofHours(12),
    };

    private final AnalyticsLiveDlqRepository repo;
    private final AnalyticsLiveIngester ingester;

    private final AtomicLong retried = new AtomicLong();
    private final AtomicLong recovered = new AtomicLong();
    private final AtomicLong gaveUp = new AtomicLong();
    private final AtomicLong lastRunAt = new AtomicLong();

    public AnalyticsLiveRetryWorker(final AnalyticsLiveDlqRepository repo,
                                      final AnalyticsLiveIngester ingester) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.ingester = Objects.requireNonNull(ingester, "ingester");
    }

    public record RetryStats(long retried, long recovered,
                               long gaveUp, long lastRunAt) { }

    public RetryStats stats() {
        return new RetryStats(retried.get(), recovered.get(),
                gaveUp.get(), lastRunAt.get());
    }

    /** One tick. Public so admin tooling + tests can force a run. */
    @Scheduled(
            fixedDelayString = "${der.analytics.live-dlq.retry-interval-millis:30000}",
            initialDelayString = "${der.analytics.live-dlq.retry-initial-delay:10000}")
    public int tick() {
        lastRunAt.set(System.currentTimeMillis());
        final List<AnalyticsLiveDlqEntry> due = repo.dueForRetry(
                Instant.now(), 100);
        int recoveredThisTick = 0;
        for (final AnalyticsLiveDlqEntry entry : due) {
            recoveredThisTick += attempt(entry) ? 1 : 0;
        }
        return recoveredThisTick;
    }

    /** Admin "Retry now" — resets next_retry_at to now so the next
     *  tick picks it up. Idempotent. Returns true if the entry
     *  existed. */
    public boolean retryNow(final java.util.UUID dlqId) {
        return repo.findById(dlqId).map(e -> {
            repo.markRetried(dlqId, e.attemptCount(), Instant.now(),
                    false, e.errorSummary());
            return true;
        }).orElse(false);
    }

    private boolean attempt(final AnalyticsLiveDlqEntry entry) {
        retried.incrementAndGet();
        try {
            ingester.handle(entry.asSourceEvent());
            // Ingester's own counters tick; if a hot-path failure
            // triggers inside handle(), the enqueue upsert keeps
            // the attempt_count where it was. Here we clear the
            // row on the assumption that handle() didn't raise —
            // if it did re-enqueue the same row, we leave the
            // bookkeeping to the next tick.
            repo.remove(entry.dlqId());
            recovered.incrementAndGet();
            return true;
        } catch (RuntimeException ex) {
            final int nextAttempt = entry.attemptCount() + 1;
            final boolean willGiveUp = nextAttempt > MAX_ATTEMPTS;
            final Duration delay = willGiveUp
                    ? Duration.ofDays(1)
                    : BACKOFF[Math.min(nextAttempt - 1, BACKOFF.length - 1)];
            repo.markRetried(entry.dlqId(), nextAttempt,
                    Instant.now().plus(delay), willGiveUp,
                    ex.getClass().getSimpleName() + ": "
                            + (ex.getMessage() == null ? "" : ex.getMessage()));
            if (willGiveUp) {
                gaveUp.incrementAndGet();
                LOG.warn("analytics live DLQ gave up on {} {} after {} attempts",
                        entry.sourceType(), entry.sourceKey(), nextAttempt - 1);
            }
            return false;
        }
    }
}
