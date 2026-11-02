package ug.ac.mak.der.workflows.pull;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.tracker.Enrollment;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity;
import ug.ac.mak.der.workflows.tracker.TrackerEvent;
import ug.ac.mak.der.workflows.tracker.TrackerEventRepository;

/**
 * ADR-0034 — inbound puller for the tracker triple
 * (TrackedEntity + Enrollment + stage event).
 *
 * <p>The three sub-families share one watermark per ADR-0034 so that
 * one central tracker tick advances the whole graph consistently.
 * Merge semantics mirror {@link AggregatePuller}: insert when absent,
 * overwrite + audit when terminal, raise CONFLICT_REVIEW when the
 * operator has an in-flight local edit.</p>
 *
 * <p>Order matters inside one pull: TEIs first, then enrollments
 * (which reference TEIs), then stage events (which reference
 * enrollments). The <strong>full</strong> graph reconciliation
 * (orphan detection, relationship bidirectional patching,
 * uniqueness-attribute enforcement) lands in Phase 10's
 * {@code TrackerGraphReconciler}; this puller only cares about the
 * three-way merge decision per row.</p>
 */
@Service
public class TrackerPuller {

    private static final Logger LOG = LoggerFactory.getLogger(TrackerPuller.class);

    @FunctionalInterface
    public interface Fetcher {
        JsonNode fetch(String orgUnitUid, Instant since) throws Exception;
    }

    private final TrackedEntityRepository teis;
    private final EnrollmentRepository enrols;
    private final TrackerEventRepository stageEvents;
    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final Dhis2ReferenceClient dhis2;
    private final ObjectMapper mapper;
    private final Clock clock;
    private volatile Fetcher fetcher;

    public TrackerPuller(final TrackedEntityRepository teis,
                           final EnrollmentRepository enrols,
                           final TrackerEventRepository stageEvents,
                           final OperationJournalRepository journal,
                           final SecurityAuditRepository audit,
                           final Dhis2ReferenceClient dhis2,
                           final ObjectMapper mapper,
                           final Clock clock) {
        this.teis = Objects.requireNonNull(teis, "teis");
        this.enrols = Objects.requireNonNull(enrols, "enrols");
        this.stageEvents = Objects.requireNonNull(stageEvents, "stageEvents");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.dhis2 = Objects.requireNonNull(dhis2, "dhis2");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.fetcher = this::defaultFetch;
    }

    public void setFetcher(final Fetcher fetcher) {
        this.fetcher = Objects.requireNonNull(fetcher, "fetcher");
    }

    public DataPullService.PullerResult pull(final String orgUnitUid, final Instant since) {
        final JsonNode response;
        try {
            response = fetcher.fetch(orgUnitUid, since);
        } catch (Exception ex) {
            throw new RuntimeException("tracker pull failed: " + ex.getMessage(), ex);
        }
        int rowsPulled = 0;
        int conflicts = 0;
        Instant maxLastUpdated = null;

        // Order matters per class javadoc: TEI → enrolment → stage event.
        for (final JsonNode t : safeArray(response, "trackedEntities")) {
            final MergeOutcome o = mergeTei(t);
            rowsPulled += o.counted() ? 1 : 0;
            conflicts += o.conflicts();
            maxLastUpdated = max(maxLastUpdated, o.lastUpdated());
        }
        for (final JsonNode e : safeArray(response, "enrollments")) {
            final MergeOutcome o = mergeEnrolment(e);
            rowsPulled += o.counted() ? 1 : 0;
            conflicts += o.conflicts();
            maxLastUpdated = max(maxLastUpdated, o.lastUpdated());
        }
        for (final JsonNode e : safeArray(response, "events")) {
            final MergeOutcome o = mergeStageEvent(e);
            rowsPulled += o.counted() ? 1 : 0;
            conflicts += o.conflicts();
            maxLastUpdated = max(maxLastUpdated, o.lastUpdated());
        }

        final Instant watermark = maxLastUpdated != null ? maxLastUpdated
                : since != null ? since : Instant.now(clock);
        return new DataPullService.PullerResult(rowsPulled, conflicts, watermark, null);
    }

    // ------------- TEI ----------------

    private MergeOutcome mergeTei(final JsonNode node) {
        final String teiUid = textOrNull(node, "trackedEntity");
        final String tet    = textOrNull(node, "trackedEntityType");
        final String ou     = textOrNull(node, "orgUnit");
        final String lu     = textOrNull(node, "lastUpdated");
        if (teiUid == null || tet == null || ou == null) {
            return MergeOutcome.NOOP;
        }
        final Instant watermark = parseInstant(lu);
        final MergeDecision decision = decide(
                OperationJournalEntry.EntityType.TRACKED_ENTITY, teiUid);
        if (decision == MergeDecision.NOOP_CONFLICT_REVIEW) {
            return new MergeOutcome(false, 0, watermark);
        }
        if (decision == MergeDecision.RAISE_CONFLICT) {
            raiseConflict(OperationJournalEntry.EntityType.TRACKED_ENTITY, teiUid,
                    "centralTei", node);
            return new MergeOutcome(false, 1, watermark);
        }
        final Optional<TrackedEntity> existing = teis.findById(teiUid);
        final boolean wasOverwrite = existing.isPresent();
        final Map<String, String> attrs = new LinkedHashMap<>();
        final JsonNode arr = node.path("attributes");
        if (arr.isArray()) {
            for (final JsonNode a : arr) {
                final String key = textOrNull(a, "attribute");
                final String val = textOrNull(a, "value");
                if (key != null) {
                    attrs.put(key, val == null ? "" : val);
                }
            }
        }
        final Instant now = Instant.now(clock);
        teis.upsert(new TrackedEntity(
                teiUid, tet, ou, attrs,
                new UUID(0L, 0L),
                existing.map(TrackedEntity::createdAt).orElse(now),
                watermark != null ? watermark : now,
                existing.map(e -> e.teiVersion() + 1).orElse(1),
                null));
        if (wasOverwrite) {
            auditOverwrite("TRACKED_ENTITY", teiUid);
        }
        return new MergeOutcome(true, 0, watermark);
    }

    // ------------- Enrollment ----------------

    private MergeOutcome mergeEnrolment(final JsonNode node) {
        final String uid     = textOrNull(node, "enrollment");
        final String teiUid  = textOrNull(node, "trackedEntity");
        final String prog    = textOrNull(node, "program");
        final String ou      = textOrNull(node, "orgUnit");
        final String statusS = textOrNull(node, "status");
        final String enDate  = textOrNull(node, "enrolledAt");
        final String inDate  = textOrNull(node, "occurredAt");
        final String lu      = textOrNull(node, "lastUpdated");
        if (uid == null || teiUid == null || prog == null || ou == null
                || statusS == null || enDate == null) {
            return MergeOutcome.NOOP;
        }
        final Instant watermark = parseInstant(lu);
        final MergeDecision decision = decide(
                OperationJournalEntry.EntityType.ENROLLMENT, uid);
        if (decision == MergeDecision.NOOP_CONFLICT_REVIEW) {
            return new MergeOutcome(false, 0, watermark);
        }
        if (decision == MergeDecision.RAISE_CONFLICT) {
            raiseConflict(OperationJournalEntry.EntityType.ENROLLMENT, uid,
                    "centralEnrolment", node);
            return new MergeOutcome(false, 1, watermark);
        }
        final Optional<Enrollment> existing = enrols.findById(uid);
        final boolean wasOverwrite = existing.isPresent();
        final Instant now = Instant.now(clock);
        enrols.upsert(new Enrollment(
                uid, teiUid, prog, ou,
                Enrollment.Status.valueOf(statusS),
                LocalDate.parse(enDate),
                inDate == null ? null : LocalDate.parse(inDate),
                null,
                new UUID(0L, 0L),
                existing.map(Enrollment::createdAt).orElse(now),
                watermark != null ? watermark : now,
                existing.map(e -> e.version() + 1).orElse(1),
                null));
        if (wasOverwrite) {
            auditOverwrite("ENROLLMENT", uid);
        }
        return new MergeOutcome(true, 0, watermark);
    }

    // ------------- Tracker-stage event ----------------

    private MergeOutcome mergeStageEvent(final JsonNode node) {
        final String uid     = textOrNull(node, "event");
        final String enrol   = textOrNull(node, "enrollment");
        final String prog    = textOrNull(node, "program");
        final String stage   = textOrNull(node, "programStage");
        final String ou      = textOrNull(node, "orgUnit");
        final String statusS = textOrNull(node, "status");
        final String occAt   = textOrNull(node, "occurredAt");
        final String lu      = textOrNull(node, "lastUpdated");
        if (uid == null || prog == null || stage == null || ou == null
                || statusS == null || occAt == null) {
            return MergeOutcome.NOOP;
        }
        final Instant watermark = parseInstant(lu);
        final MergeDecision decision = decide(
                OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT, uid);
        if (decision == MergeDecision.NOOP_CONFLICT_REVIEW) {
            return new MergeOutcome(false, 0, watermark);
        }
        if (decision == MergeDecision.RAISE_CONFLICT) {
            raiseConflict(OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT, uid,
                    "centralStageEvent", node);
            return new MergeOutcome(false, 1, watermark);
        }
        final Optional<TrackerEvent> existing = stageEvents.findById(uid);
        final boolean wasOverwrite = existing.isPresent();
        final Map<String, Object> values = new LinkedHashMap<>();
        final JsonNode dvs = node.path("dataValues");
        if (dvs.isArray()) {
            for (final JsonNode dv : dvs) {
                final String de = textOrNull(dv, "dataElement");
                final String v  = textOrNull(dv, "value");
                if (de != null) {
                    values.put(de, v == null ? "" : v);
                }
            }
        }
        final Instant now = Instant.now(clock);
        stageEvents.upsert(new TrackerEvent(
                uid, enrol, prog, stage, ou,
                TrackerEvent.Status.valueOf(statusS),
                LocalDate.parse(occAt.substring(0, Math.min(10, occAt.length()))),
                values, null,
                new UUID(0L, 0L),
                existing.map(TrackerEvent::createdAt).orElse(now),
                watermark != null ? watermark : now,
                existing.map(e -> e.version() + 1).orElse(1),
                null));
        if (wasOverwrite) {
            auditOverwrite("PROGRAM_STAGE_EVENT", uid);
        }
        return new MergeOutcome(true, 0, watermark);
    }

    // ------------- shared merge-decision logic ----------------

    private enum MergeDecision { PROCEED, RAISE_CONFLICT, NOOP_CONFLICT_REVIEW }

    private MergeDecision decide(final OperationJournalEntry.EntityType et, final String ref) {
        final Optional<OperationJournalEntry> row = journal.findLatestByEntityRef(et, ref);
        if (row.isEmpty()) {
            return MergeDecision.PROCEED;
        }
        final OperationJournalEntry.State s = row.get().state();
        if (s == OperationJournalEntry.State.CONFLICT_REVIEW) {
            return MergeDecision.NOOP_CONFLICT_REVIEW;
        }
        if (s == OperationJournalEntry.State.CENTRAL_ACCEPTED
                || s == OperationJournalEntry.State.CENTRAL_REJECTED) {
            return MergeDecision.PROCEED;
        }
        return MergeDecision.RAISE_CONFLICT;
    }

    private void raiseConflict(final OperationJournalEntry.EntityType entityType,
                                 final String entityRef, final String label,
                                 final JsonNode payload) {
        final JsonNode body;
        try {
            body = mapper.readTree(mapper.writeValueAsString(Map.of(label, payload)));
        } catch (Exception ex) {
            throw new IllegalStateException("failed to serialise conflict payload", ex);
        }
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(), entityType, entityRef, body,
                OperationJournalEntry.State.CONFLICT_REVIEW,
                0, "central-pull collision — operator-pending local edit",
                null,
                Instant.now(clock), Instant.now(clock), null, null));
    }

    private void auditOverwrite(final String entityType, final String ref) {
        audit.append(new AuditEvent(
                "DATA_PULL_OVERWRITE",
                AuditEvent.Outcome.SUCCESS,
                null, null, null, null,
                Map.of("entityType", entityType, "ref", ref)),
                Instant.now(clock));
    }

    // ------------- helpers ----------------

    private JsonNode defaultFetch(final String orgUnitUid, final Instant since) throws Exception {
        final String lu = since == null ? "" : "&updatedAfter=" + since.toString();
        return dhis2.fetchJson("/api/tracker?orgUnit=" + orgUnitUid
                + "&orgUnitMode=DESCENDANTS" + lu);
    }

    private static Iterable<JsonNode> safeArray(final JsonNode root, final String field) {
        final JsonNode arr = root == null ? null : root.path(field);
        return arr != null && arr.isArray() ? arr : java.util.Collections.emptyList();
    }

    private static String textOrNull(final JsonNode n, final String field) {
        final JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static Instant parseInstant(final String s) {
        if (s == null) {
            return null;
        }
        try {
            return Instant.parse(s);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static Instant max(final Instant a, final Instant b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.isAfter(b) ? a : b;
    }

    /** Internal merge-row result. {@code counted}=true means an actual
     *  insert or overwrite happened; conflicts are reported separately
     *  so DataPullService.PullOutcome stays unambiguous. */
    private record MergeOutcome(boolean counted, int conflicts, Instant lastUpdated) {
        static final MergeOutcome NOOP = new MergeOutcome(false, 0, null);
    }
}
