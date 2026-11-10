package ug.ac.mak.der.sync.policy;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

/** Single-threaded daemon scheduler for {@link InstantDrainTrigger}.
 *  A single thread is enough: the drain itself is bounded by batch
 *  size and runs on its own transaction; serialising instant drains
 *  prevents thundering herds when a burst of writes lands. */
@Configuration
public class SyncPolicyConfig {

    @Bean
    public ScheduledExecutorService instantDrainExecutor() {
        return Executors.newSingleThreadScheduledExecutor(new DaemonFactory());
    }

    /** Exposes {@link InstantDrainTrigger#onWrite} as a plain
     *  {@code Consumer} so {@link
     *  ug.ac.mak.der.workflows.aggregate.OperationJournalRepository}
     *  can call it without taking a compile-time dependency on the
     *  sync-policy package (keeps the write path inert if the
     *  sync-policy beans are ever disabled). */
    @Bean
    public Consumer<OperationJournalEntry.EntityType>
            instantDrainNotifier(final InstantDrainTrigger trigger) {
        return trigger::onWrite;
    }

    private static final class DaemonFactory implements ThreadFactory {
        private final AtomicInteger counter = new AtomicInteger(0);

        @Override
        public Thread newThread(final Runnable r) {
            final Thread t = new Thread(r,
                    "der-instant-drain-" + counter.incrementAndGet());
            t.setDaemon(true);
            return t;
        }
    }
}
