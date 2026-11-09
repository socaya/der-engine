package ug.ac.mak.der.workflows.tracker;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * §2.3.96 R-D/tracker-svc — single-transaction wrapper around the
 * tracker upsert → operation_journal.insert → audit pair.
 *
 * <p>Mirrors {@code AggregateDataValueService} + {@code EventService}
 * — both of which keep the local write and the outbox entry in one
 * {@code @Transactional} unit so a crash between the two can never
 * leave a row in the local store without a matching journal entry
 * (or vice-versa).</p>
 *
 * <p>Replaces direct calls to {@code TrackedEntityRepository.upsert},
 * {@code EnrollmentRepository.upsert}, {@code TrackerEventRepository.upsert}
 * from the three tracker controllers.</p>
 */
@Service
public class TrackerService {

    private static final Logger LOG = LoggerFactory.getLogger(TrackerService.class);

    private final TrackedEntityRepository teis;
    private final EnrollmentRepository enrolments;
    private final TrackerEventRepository trackerEvents;
    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    public TrackerService(final TrackedEntityRepository teis,
                            final EnrollmentRepository enrolments,
                            final TrackerEventRepository trackerEvents,
                            final OperationJournalRepository journal,
                            final SecurityAuditRepository audit,
                            final ObjectMapper mapper,
                            final Clock clock) {
        this.teis = Objects.requireNonNull(teis, "teis");
        this.enrolments = Objects.requireNonNull(enrolments, "enrolments");
        this.trackerEvents = Objects.requireNonNull(trackerEvents, "trackerEvents");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** Persist a tracked entity + enqueue its outbox entry
     *  atomically. The record's {@code workflowRunId} is carried
     *  into the journal row so lineage round-trips.
     *
     *  <p>Additionally, if the TEI has any ACTIVE enrolments and the
     *  payload carries attribute values, an ENROLLMENT journal entry
     *  is enqueued per enrolment with those attributes attached.
     *  DHIS2 2.44 scopes most TEAs to the program (not the TET), so
     *  a plain TEI write accepts the import but the attribute values
     *  don't surface on reads. Threading them through the enrolment
     *  envelope lands them where DHIS2 reads expect them.</p> */
    @Transactional
    public TrackedEntityRepository.TrackedEntity upsertTei(
            final TrackedEntityRepository.TrackedEntity tei,
            final UUID actor,
            final String ip, final String userAgent) {
        Objects.requireNonNull(tei, "tei");
        Objects.requireNonNull(actor, "actor");
        final Instant now = Instant.now(clock);
        final TrackedEntityRepository.TrackedEntity stored = teis.upsert(tei);
        final Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("teiUid",            stored.teiUid());
        payload.put("trackedEntityType", stored.trackedEntityType());
        payload.put("orgUnit",           stored.orgUnitUid());
        payload.put("attributes",        stored.attributes());
        payload.put("teiVersion",        stored.teiVersion());
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.TRACKED_ENTITY,
                stored.teiUid(),
                mapper.valueToTree(payload),
                OperationJournalEntry.State.PENDING,
                0, null, actor, now, now, null, stored.workflowRunId()));
        enqueueEnrolmentAttrSyncs(stored, actor, now);
        audit.append(new AuditEvent(
                "TRACKED_ENTITY_WRITE_SUCCESS", AuditEvent.Outcome.SUCCESS,
                actor, null, ip, userAgent,
                Map.of("teiUid", stored.teiUid())
        ), now);
        LOG.debug("tei upsert: uid={} runId={}", stored.teiUid(), stored.workflowRunId());
        return stored;
    }

    /** For each ACTIVE enrolment of {@code tei}, enqueue an
     *  ENROLLMENT journal entry whose payload mirrors the enrolment
     *  identity fields + the TEI's current attributes. The journal
     *  publisher drains these through /api/tracker so central sees
     *  the program-scoped TEA values on the enrolment context —
     *  without this, a Profile edit on the TEI dashboard writes
     *  only the TEI shell and central's GET reads attributes:[]. */
    private void enqueueEnrolmentAttrSyncs(
            final TrackedEntityRepository.TrackedEntity tei,
            final UUID actor, final Instant now) {
        if (tei.attributes() == null || tei.attributes().isEmpty()) {
            return;
        }
        final java.util.List<Enrollment> active;
        try {
            active = enrolments.findByTei(tei.teiUid()).stream()
                    .filter(e -> e.status() == Enrollment.Status.ACTIVE)
                    .toList();
        } catch (RuntimeException ex) {
            LOG.debug("enrol lookup for attr sync failed: {}",
                    ex.getMessage());
            return;
        }
        for (final Enrollment e : active) {
            final Map<String, Object> enrolPayload = new LinkedHashMap<>();
            enrolPayload.put("enrollmentUid", e.enrollmentUid());
            enrolPayload.put("teiUid",        e.teiUid());
            enrolPayload.put("program",       e.programUid());
            enrolPayload.put("orgUnit",       e.orgUnitUid());
            enrolPayload.put("status",        e.status().name());
            enrolPayload.put("enrollmentDate",
                    e.enrollmentDate().toString());
            if (e.incidentDate() != null) {
                enrolPayload.put("incidentDate",
                        e.incidentDate().toString());
            }
            enrolPayload.put("attributes",    tei.attributes());
            journal.insert(new OperationJournalEntry(
                    UUID.randomUUID(),
                    OperationJournalEntry.EntityType.ENROLLMENT,
                    e.enrollmentUid(),
                    mapper.valueToTree(enrolPayload),
                    OperationJournalEntry.State.PENDING,
                    0, null, actor, now, now, null,
                    e.workflowRunId()));
        }
    }

    /** Persist an enrolment + enqueue its outbox entry atomically. */
    @Transactional
    public Enrollment upsertEnrollment(final Enrollment e,
                                         final UUID actor,
                                         final String ip, final String userAgent) {
        Objects.requireNonNull(e, "enrollment");
        Objects.requireNonNull(actor, "actor");
        final Instant now = Instant.now(clock);
        final Enrollment stored = enrolments.upsert(e);
        final Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("enrollmentUid",  stored.enrollmentUid());
        payload.put("teiUid",         stored.teiUid());
        payload.put("program",        stored.programUid());
        payload.put("orgUnit",        stored.orgUnitUid());
        payload.put("status",         stored.status().name());
        payload.put("enrollmentDate", stored.enrollmentDate().toString());
        if (stored.incidentDate() != null) {
            payload.put("incidentDate", stored.incidentDate().toString());
        }
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.ENROLLMENT,
                stored.enrollmentUid(),
                mapper.valueToTree(payload),
                OperationJournalEntry.State.PENDING,
                0, null, actor, now, now, null, stored.workflowRunId()));
        audit.append(new AuditEvent(
                "ENROLLMENT_WRITE_SUCCESS", AuditEvent.Outcome.SUCCESS,
                actor, null, ip, userAgent,
                Map.of("enrollmentUid", stored.enrollmentUid(),
                        "teiUid",        stored.teiUid())
        ), now);
        LOG.debug("enrol upsert: uid={} runId={}", stored.enrollmentUid(), stored.workflowRunId());
        return stored;
    }

    /** Persist a tracker stage event + enqueue its outbox entry atomically. */
    @Transactional
    public TrackerEvent upsertEvent(final TrackerEvent e,
                                      final UUID actor,
                                      final String ip, final String userAgent) {
        Objects.requireNonNull(e, "event");
        Objects.requireNonNull(actor, "actor");
        final Instant now = Instant.now(clock);
        final TrackerEvent stored = trackerEvents.upsert(e);
        final Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventUid",      stored.eventUid());
        payload.put("enrollmentUid", stored.enrollmentUid());
        payload.put("program",       stored.programUid());
        payload.put("programStage",  stored.programStageUid());
        payload.put("orgUnit",       stored.orgUnitUid());
        payload.put("status",        stored.status().name());
        payload.put("occurredDate",  stored.occurredDate().toString());
        payload.put("dataValues",    stored.dataValues());
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT,
                stored.eventUid(),
                mapper.valueToTree(payload),
                OperationJournalEntry.State.PENDING,
                0, null, actor, now, now, null, stored.workflowRunId()));
        audit.append(new AuditEvent(
                "TRACKER_EVENT_WRITE_SUCCESS", AuditEvent.Outcome.SUCCESS,
                actor, null, ip, userAgent,
                Map.of("eventUid", stored.eventUid())
        ), now);
        LOG.debug("tracker evt upsert: uid={} runId={}", stored.eventUid(), stored.workflowRunId());
        return stored;
    }
}
