package ug.ac.mak.der.workflows.tracker;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Phase 10.1 — graph integrity checks over the tracker triple.
 *
 * <p>Runs after every tracker pull. Two reconciliation passes:</p>
 * <ul>
 *   <li><strong>Orphan enrolments</strong> — enrolments whose
 *     {@code tei_uid} does not resolve. Raises a
 *     {@code CONFLICT_REVIEW} journal row keyed on the enrolment
 *     UID so the attention queue surfaces the dangling reference.
 *     The row is kept intact so the operator can still see it in
 *     the tracker list; only the sync-outbox state is flipped.</li>
 *   <li><strong>Orphan stage events</strong> — tracker events whose
 *     {@code enrollment_uid} does not resolve. Same treatment.</li>
 * </ul>
 *
 * <p>The reconciler is explicitly NOT a schema-level cascade: it
 * does not delete rows. Operators resolve conflicts via the
 * existing {@code /journal/conflicts/{id}/resolve} endpoint. The
 * next pull tick typically fixes transient split-across-pages
 * orphans automatically — a conflict row that stayed open for &gt;
 * two reconciler runs is a real problem.</p>
 *
 * <p>Audit-event bookkeeping:</p>
 * <ul>
 *   <li>Every orphan found emits one {@code TRACKER_ORPHAN_DETECTED}
 *     audit event, so the operator-facing feed shows the full
 *     history even after conflicts are resolved.</li>
 * </ul>
 */
@Service
public class TrackerGraphReconciler {

    private static final Logger LOG = LoggerFactory.getLogger(TrackerGraphReconciler.class);

    private static final int BATCH_LIMIT = 200;

    private final EnrollmentRepository enrols;
    private final TrackerEventRepository stageEvents;
    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    public TrackerGraphReconciler(final EnrollmentRepository enrols,
                                     final TrackerEventRepository stageEvents,
                                     final OperationJournalRepository journal,
                                     final SecurityAuditRepository audit,
                                     final ObjectMapper mapper,
                                     final Clock clock) {
        this.enrols = Objects.requireNonNull(enrols, "enrols");
        this.stageEvents = Objects.requireNonNull(stageEvents, "stageEvents");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public ReconcileReport reconcile() {
        final Instant now = Instant.now(clock);
        int orphanEnrolments = 0;
        int orphanEvents = 0;
        for (final Enrollment e : enrols.findOrphans(BATCH_LIMIT)) {
            raiseOrphanConflict(
                    OperationJournalEntry.EntityType.ENROLLMENT,
                    e.enrollmentUid(),
                    Map.of("teiUid", e.teiUid(), "programUid", e.programUid()),
                    "enrolment references TEI not in the local mirror",
                    now);
            orphanEnrolments++;
        }
        for (final TrackerEvent ev : stageEvents.findOrphans(BATCH_LIMIT)) {
            raiseOrphanConflict(
                    OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT,
                    ev.eventUid(),
                    Map.of("enrollmentUid", ev.enrollmentUid() == null ? "" : ev.enrollmentUid(),
                            "programStageUid", ev.programStageUid()),
                    "stage event references enrolment not in the local mirror",
                    now);
            orphanEvents++;
        }
        if (orphanEnrolments + orphanEvents > 0) {
            LOG.info("TrackerGraphReconciler raised {} enrolment + {} event orphan conflicts",
                    orphanEnrolments, orphanEvents);
        }
        return new ReconcileReport(orphanEnrolments, orphanEvents);
    }

    private void raiseOrphanConflict(final OperationJournalEntry.EntityType entityType,
                                        final String entityRef,
                                        final Map<String, Object> payload,
                                        final String reason,
                                        final Instant now) {
        final JsonNode body;
        try {
            body = mapper.readTree(mapper.writeValueAsString(
                    Map.of("orphan", payload, "reason", reason)));
        } catch (Exception ex) {
            throw new IllegalStateException("failed to serialise orphan payload", ex);
        }
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(), entityType, entityRef, body,
                OperationJournalEntry.State.CONFLICT_REVIEW,
                0, reason, null, now, now, null, null));
        audit.append(new AuditEvent(
                "TRACKER_ORPHAN_DETECTED",
                AuditEvent.Outcome.SUCCESS,
                null, null, null, null,
                Map.of("entityType", entityType.name(),
                        "entityRef", entityRef,
                        "reason", reason)),
                now);
    }

    /** One reconcile tick's outcome; wired into the admin UI
     *  via the data-pull job's run detail JSON. */
    public record ReconcileReport(int orphanEnrolments, int orphanEvents) {
        public int total() {
            return orphanEnrolments + orphanEvents;
        }
    }
}
