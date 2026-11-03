package ug.ac.mak.der.workflows.pull;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.network.CentralReachabilityGate;
import ug.ac.mak.der.observability.DerMetrics;
import ug.ac.mak.der.workflows.tracker.TrackerGraphReconciler;

/**
 * ADR-0034 — orchestrates the three per-entity pullers (aggregate /
 * event / tracker).
 *
 * <p>Phase 09.2 ships the skeleton: cursor read, reachability gate
 * read, cursor update on success / failure, {@link PullOutcome}
 * surface for the admin UI. The three pullers themselves land in
 * 09.3 (aggregate) and 09.4 (event + tracker) — this class stays as
 * the single coordination point.</p>
 *
 * <p>Not called by anything yet; wired to {@code DataPullJob} in
 * 09.5. Shipping the skeleton + repo + cursor first lets the
 * migration land independently and the admin-ui start reading the
 * cursor table while the puller code is still in flight.</p>
 */
@Service
public class DataPullService {

    private static final Logger LOG = LoggerFactory.getLogger(DataPullService.class);

    private final DataPullCursorRepository cursors;
    private final CentralReachabilityGate reachability;
    private final Clock clock;
    private final AggregatePuller aggregatePuller;
    private final EventPuller eventPuller;
    private final TrackerPuller trackerPuller;
    private final TrackerGraphReconciler trackerReconciler;
    private final DerMetrics metrics;

    public DataPullService(final DataPullCursorRepository cursors,
                             final CentralReachabilityGate reachability,
                             final Clock clock,
                             final AggregatePuller aggregatePuller,
                             final EventPuller eventPuller,
                             final TrackerPuller trackerPuller,
                             final TrackerGraphReconciler trackerReconciler,
                             final DerMetrics metrics) {
        this.cursors = Objects.requireNonNull(cursors, "cursors");
        this.reachability = Objects.requireNonNull(reachability, "reachability");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.aggregatePuller = Objects.requireNonNull(aggregatePuller, "aggregatePuller");
        this.eventPuller = Objects.requireNonNull(eventPuller, "eventPuller");
        this.trackerPuller = Objects.requireNonNull(trackerPuller, "trackerPuller");
        this.trackerReconciler = Objects.requireNonNull(trackerReconciler, "trackerReconciler");
        this.metrics = Objects.requireNonNull(metrics, "metrics");
    }

    /**
     * Pull everything central has for the given org-unit subtree
     * since the last stored watermark. Returns an outcome row the
     * admin UI can render on {@code /data/overview}.
     *
     * <p>No-op if {@link CentralReachabilityGate} is OFFLINE —
     * follows the same gate semantics as the sync drain so operators
     * get consistent "skipped: central unreachable" messages across
     * the whole system.</p>
     */
    public PullOutcome pullAll(final String orgUnitUid) {
        if (!reachability.shouldDrain()) {
            return new PullOutcome(orgUnitUid, 0, 0, 0, 0,
                    "skipped: central unreachable");
        }
        int aggregate = 0;
        int events = 0;
        int tracker = 0;
        int conflicts = 0;
        for (final DataPullCursor.EntityType et : DataPullCursor.EntityType.values()) {
            try {
                final PullerResult r = pullOne(et, orgUnitUid);
                switch (et) {
                    case AGGREGATE -> aggregate += r.rowsPulled();
                    case EVENT     -> events    += r.rowsPulled();
                    case TRACKER   -> tracker   += r.rowsPulled();
                }
                conflicts += r.conflicts();
                cursors.markSuccess(et, orgUnitUid, r.watermark(), r.cursor());
                metrics.pullOutcome(et.name(), "success");
            } catch (RuntimeException ex) {
                LOG.warn("DataPullService.pullOne({}, {}) failed: {}", et, orgUnitUid,
                        ex.getMessage());
                cursors.markFailure(et, orgUnitUid, ex.getMessage());
                metrics.pullOutcome(et.name(), "failure");
            }
        }
        /* Phase 10.1 — after the tracker puller has drained its
         * batch, run the graph reconciler to catch orphans central
         * split across pages or that central deleted. Orphans
         * surface as CONFLICT_REVIEW rows + TRACKER_ORPHAN_DETECTED
         * audit entries. We count them into `conflicts` so the pull
         * outcome aggregates the operator-attention total across
         * both pull-time collisions and post-pull graph issues. */
        final TrackerGraphReconciler.ReconcileReport report = trackerReconciler.reconcile();
        conflicts += report.total();
        return new PullOutcome(orgUnitUid, aggregate, events, tracker, conflicts, null);
    }

    /**
     * Dispatches to the per-entity puller. AGGREGATE lands in Phase
     * 09.3 (now); EVENT + TRACKER stay as empty stubs until 09.4.
     *
     * <p>Package-private so the test suite can swap it with an
     * override when exercising orchestration contract behaviour.</p>
     */
    PullerResult pullOne(final DataPullCursor.EntityType entityType,
                          final String orgUnitUid) {
        final Instant since = cursors.findByScope(entityType, orgUnitUid)
                .map(DataPullCursor::lastPulledAt).orElse(null);
        return switch (entityType) {
            case AGGREGATE -> aggregatePuller.pull(orgUnitUid, since);
            case EVENT     -> eventPuller.pull(orgUnitUid, since);
            case TRACKER   -> trackerPuller.pull(orgUnitUid, since);
        };
    }

    public List<DataPullCursor> cursors() {
        return cursors.findAll();
    }

    /** The result of one puller tick, surfaced on the admin UI. */
    public record PullOutcome(String orgUnitUid, int aggregatePulled,
                                int eventsPulled, int trackerPulled,
                                int conflictsRaised, String note) { }

    /** Internal — one puller's result row. */
    record PullerResult(int rowsPulled, int conflicts,
                          Instant watermark, String cursor) { }
}
