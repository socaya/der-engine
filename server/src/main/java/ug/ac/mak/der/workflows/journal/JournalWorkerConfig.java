package ug.ac.mak.der.workflows.journal;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Config bean + runtime toggle for the Phase 04 journal worker.
 *
 *  <p>SM-3c — all four tunables (enabled, batchSize, backoffBase,
 *  backoffCap) are now Atomic* so an admin can adjust them live via
 *  {@code POST /edge-api/v1/journal/worker/tune}. Env-var values
 *  remain the boot baseline.</p>
 */
@Configuration
public class JournalWorkerConfig {

    @Bean
    public JournalWorkerSettings journalWorkerSettings(
            @Value("${der.journal.drain.enabled:true}") final boolean enabled,
            @Value("${der.journal.drain.batch-size:25}") final int batchSize,
            @Value("${der.journal.drain.backoff-base-seconds:30}") final long backoffBase,
            @Value("${der.journal.drain.backoff-cap-seconds:3600}") final long backoffCap) {
        return new JournalWorkerSettings(
                new AtomicBoolean(enabled),
                new AtomicInteger(Math.max(1, Math.min(500, batchSize))),
                new AtomicLong(Math.max(1, backoffBase)),
                new AtomicLong(Math.max(1, backoffCap)));
    }

    /** Live-mutable journal-worker settings. Each field is an
     *  Atomic* so admin tune actions don't need worker restarts. */
    public record JournalWorkerSettings(
            AtomicBoolean enabled,
            AtomicInteger batchSizeRef,
            AtomicLong backoffBaseSecondsRef,
            AtomicLong backoffCapSecondsRef) {

        public int batchSize() {
            return batchSizeRef.get();
        }

        public long backoffBaseSeconds() {
            return backoffBaseSecondsRef.get();
        }

        public long backoffCapSeconds() {
            return backoffCapSecondsRef.get();
        }
    }
}
