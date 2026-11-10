package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Journal-stream consumer that materialises analytics cells in real
 * time as tracker events + enrollments commit.
 *
 * <p>Spec §15 Phase 2b — moves the ingestion path from the operator-
 * triggered batch job into the write path itself. The listener runs
 * {@code AFTER_COMMIT} so a rolled-back source write never reaches
 * the analytics ledger, and {@code Async} so the capture latency
 * stays independent of analytics work.</p>
 *
 * <p>Failure handling: every applied contribution is wrapped so an
 * analytics-side error logs + advances the lag counter but never
 * propagates back to the capture caller. Phase 3 wires this to a
 * dead-letter queue for retry.</p>
 */
@Component
public class AnalyticsLiveIngester {

    private static final Logger LOG =
            LoggerFactory.getLogger(AnalyticsLiveIngester.class);

    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsMaterializer materializer;
    private final AnalyticsPeriodEnumerator periods;

    // Cheap in-memory counters for the /quality + /admin/jobs
    // endpoints so operators see live ingestion health without
    // peering into logs.
    private final AtomicLong applied = new AtomicLong();
    private final AtomicLong skipped = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();
    private final ConcurrentHashMap<AnalyticsSourceEvent.SourceType, Long>
            lastAppliedAt = new ConcurrentHashMap<>();

    public AnalyticsLiveIngester(final AnalyticsEngineRepository engineRepo,
                                   final AnalyticsMaterializer materializer,
                                   final AnalyticsPeriodEnumerator periods) {
        this.engineRepo = engineRepo;
        this.materializer = materializer;
        this.periods = periods;
    }

    /** Transactional listener — runs after the capture transaction
     *  commits, so a rolled-back source never produces an analytics
     *  contribution. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT,
                                 fallbackExecution = true)
    public void onCommittedSourceChange(final AnalyticsSourceEvent event) {
        handle(event);
    }

    /** Synchronous handler — exposed for tests and for environments
     *  where the Spring transaction manager hasn't been configured.
     *  The transactional listener delegates here too. */
    void handle(final AnalyticsSourceEvent event) {
        try {
            final String code = codeFor(event.sourceType());
            final Optional<AnalyticsDefinition> defOpt =
                    engineRepo.findDefinitionByCode(code);
            if (defOpt.isEmpty()) {
                // Seed hasn't run yet (test boot, fresh DB). Not an
                // error — the operator-triggered ingest on next admin
                // POST will backfill.
                skipped.incrementAndGet();
                return;
            }
            final AnalyticsDefinition def = defOpt.get();
            final String periodKey = periods.windowContaining(
                    AnalyticsPeriodEnumerator.Type.MONTHLY,
                    event.occurredOn()).id();
            final boolean eligible = isEligible(event);
            final AnalyticsContribution contribution =
                    new AnalyticsContribution(def.id(),
                            def.definitionVersion(),
                            event.sourceKey(),
                            String.valueOf(event.sourceVersion()),
                            periodKey,
                            event.orgUnitUid(),
                            "",
                            BigDecimal.ONE,
                            eligible,
                            "COMMITTED",
                            null, null);
            materializer.applyContribution(def, contribution);
            applied.incrementAndGet();
            lastAppliedAt.put(event.sourceType(), System.currentTimeMillis());
        } catch (RuntimeException ex) {
            failed.incrementAndGet();
            LOG.warn("analytics live ingest failed for {} {} v{}: {}",
                    event.sourceType(), event.sourceKey(),
                    event.sourceVersion(), ex.getMessage());
        }
    }

    private static String codeFor(final AnalyticsSourceEvent.SourceType t) {
        return switch (t) {
            case EVENT -> AnalyticsSeed.EVENT_COUNT_CODE;
            case ENROLLMENT -> AnalyticsSeed.ENROLLMENT_COUNT_CODE;
        };
    }

    private static boolean isEligible(final AnalyticsSourceEvent e) {
        return switch (e.sourceType()) {
            // Skip SKIPPED events — the operator explicitly declared
            // the stage didn't happen; counting it would be wrong.
            case EVENT -> !"SKIPPED".equalsIgnoreCase(e.status());
            // Cancelled enrolments shouldn't pad the count either.
            case ENROLLMENT -> !"CANCELLED".equalsIgnoreCase(e.status());
        };
    }

    /** Snapshot of the live counters for the /quality + /admin/jobs
     *  endpoints. */
    public LiveStats stats() {
        return new LiveStats(
                applied.get(), skipped.get(), failed.get(),
                lastAppliedAt.getOrDefault(
                        AnalyticsSourceEvent.SourceType.EVENT, 0L),
                lastAppliedAt.getOrDefault(
                        AnalyticsSourceEvent.SourceType.ENROLLMENT, 0L));
    }

    public record LiveStats(long applied, long skipped, long failed,
                              long lastEventAppliedAt,
                              long lastEnrollmentAppliedAt) { }
}
