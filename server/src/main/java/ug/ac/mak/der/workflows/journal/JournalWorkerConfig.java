package ug.ac.mak.der.workflows.journal;

import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Config bean + runtime toggle for the Phase 04 journal worker. */
@Configuration
public class JournalWorkerConfig {

    @Bean
    public JournalWorkerSettings journalWorkerSettings(
            @Value("${der.journal.drain.enabled:true}") final boolean enabled,
            @Value("${der.journal.drain.batch-size:25}") final int batchSize,
            @Value("${der.journal.drain.backoff-base-seconds:30}") final long backoffBase,
            @Value("${der.journal.drain.backoff-cap-seconds:3600}") final long backoffCap) {
        return new JournalWorkerSettings(new AtomicBoolean(enabled), batchSize, backoffBase, backoffCap);
    }

    public record JournalWorkerSettings(AtomicBoolean enabled, int batchSize, long backoffBaseSeconds,
                                         long backoffCapSeconds) { }
}
