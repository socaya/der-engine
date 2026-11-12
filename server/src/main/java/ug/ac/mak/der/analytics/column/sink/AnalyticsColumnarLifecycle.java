package ug.ac.mak.der.analytics.column.sink;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Builds a shadow generation, verifies it against the authoritative row
 * store, publishes atomically, then compacts generations outside the
 * rollback window.
 */
@Service
public class AnalyticsColumnarLifecycle {

    private static final Logger LOG = LoggerFactory.getLogger(
            AnalyticsColumnarLifecycle.class);

    private final AnalyticsColumnarLifecycleProperties lifecycle;
    private final AnalyticsColumnarSink sink;
    private final AnalyticsColumnarVerifier verifier;
    private final AnalyticsColumnarCompactor compactor;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicReference<LifecycleStatus> status =
            new AtomicReference<>(LifecycleStatus.idle());

    public AnalyticsColumnarLifecycle(
            final AnalyticsColumnarLifecycleProperties lifecycle,
            final AnalyticsColumnarSink sink,
            final AnalyticsColumnarVerifier verifier,
            final AnalyticsColumnarCompactor compactor) {
        this.lifecycle = lifecycle;
        this.sink = sink;
        this.verifier = verifier;
        this.compactor = compactor;
    }

    @Scheduled(
            initialDelayString = "${der.analytics.columnar.lifecycle.initial-delay-millis:15000}",
            fixedDelayString = "${der.analytics.columnar.lifecycle.fixed-delay-millis:60000}")
    public void scheduledRun() {
        if (!lifecycle.enabled()) {
            return;
        }
        runNow();
    }

    public LifecycleStatus runNow() {
        if (!lifecycle.enabled()) {
            final LifecycleStatus disabled = new LifecycleStatus("DISABLED",
                    null, null, -1, 0, 0, 0, 0L, 0L, 1.0, null);
            status.set(disabled);
            return disabled;
        }
        if (!running.compareAndSet(false, true)) {
            return status.get();
        }
        final Instant started = Instant.now();
        status.set(new LifecycleStatus("BUILDING", started, null, -1,
                0, 0, 0, 0L, 0L, 1.0, null));
        AnalyticsColumnarSink.PreparedFlush prepared = null;
        boolean generationPublished = false;
        try {
            prepared = sink.prepare();
            if (prepared.manifest() == null) {
                final LifecycleStatus disabled = new LifecycleStatus(
                        "DISABLED", started, Instant.now(), -1,
                        0, 0, 0, 0L, 0L, 1.0, null);
                status.set(disabled);
                return disabled;
            }
            final AnalyticsColumnarVerifier.VerifyReport report =
                    verifier.verify(prepared.manifest());
            if (report.rowsDrifted() > 0) {
                sink.discard(prepared);
                final LifecycleStatus drift = new LifecycleStatus(
                        "DRIFT_REJECTED", started, Instant.now(),
                        prepared.manifest().generation(),
                        prepared.result().rowsWritten(),
                        report.rowsOk(), report.rowsDrifted(), 0L,
                        prepared.result().bytesWritten(),
                        prepared.result().compressionRatio(),
                        report.drifts().get(0).reason());
                status.set(drift);
                LOG.error("columnar generation {} rejected: {} drift rows",
                        report.generation(), report.rowsDrifted());
                return drift;
            }
            sink.publish(prepared);
            generationPublished = true;
            final AnalyticsColumnarCompactor.CompactionResult compacted;
            try {
                compacted = compactor.compact();
            } catch (IOException | RuntimeException ex) {
                final LifecycleStatus warning = new LifecycleStatus(
                        "PUBLISHED_COMPACTION_PENDING", started, Instant.now(),
                        prepared.manifest().generation(),
                        prepared.result().rowsWritten(), report.rowsOk(), 0,
                        0L, prepared.result().bytesWritten(),
                        prepared.result().compressionRatio(), ex.getMessage());
                status.set(warning);
                LOG.warn("columnar generation {} published but compaction "
                                + "will retry on the next lifecycle run",
                        prepared.manifest().generation(), ex);
                return warning;
            }
            final LifecycleStatus published = new LifecycleStatus(
                    "PUBLISHED", started, Instant.now(),
                    prepared.manifest().generation(),
                    prepared.result().rowsWritten(), report.rowsOk(), 0,
                    compacted.bytesReclaimed(),
                    prepared.result().bytesWritten(),
                    prepared.result().compressionRatio(), null);
            status.set(published);
            return published;
        } catch (IOException | RuntimeException ex) {
            if (!generationPublished && prepared != null) {
                try {
                    sink.discard(prepared);
                } catch (IOException cleanupFailure) {
                    ex.addSuppressed(cleanupFailure);
                }
            }
            final LifecycleStatus failed = new LifecycleStatus("FAILED",
                    started, Instant.now(), -1, 0, 0, 0, 0L, 0L, 1.0,
                    ex.getMessage());
            status.set(failed);
            LOG.error("columnar lifecycle failed", ex);
            return failed;
        } finally {
            running.set(false);
        }
    }

    public LifecycleStatus status() {
        return status.get();
    }

    public record LifecycleStatus(String state,
                                  Instant startedAt,
                                  Instant completedAt,
                                  long generation,
                                  int rowsWritten,
                                  int rowsVerified,
                                  int rowsDrifted,
                                  long bytesReclaimed,
                                  long bytesWritten,
                                  double compressionRatio,
                                  String error) {
        static LifecycleStatus idle() {
            return new LifecycleStatus("IDLE", null, null, -1,
                    0, 0, 0, 0L, 0L, 1.0, null);
        }
    }
}
