package ug.ac.mak.der.workflows.pull;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
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
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventRepository;

/**
 * ADR-0034 — inbound puller for the standalone-events stream.
 *
 * <p>Follows the same three-way merge as {@link AggregatePuller} but
 * keyed on the event UID. Central-origin events get the all-zeros
 * UUID as {@code createdBy} to mark "SYSTEM pull".</p>
 */
@Service
public class EventPuller {

    private static final Logger LOG = LoggerFactory.getLogger(EventPuller.class);

    @FunctionalInterface
    public interface Fetcher {
        JsonNode fetch(String orgUnitUid, Instant since) throws Exception;
    }

    private final EventRepository events;
    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final Dhis2ReferenceClient dhis2;
    private final ObjectMapper mapper;
    private final Clock clock;
    private volatile Fetcher fetcher;

    public EventPuller(final EventRepository events,
                         final OperationJournalRepository journal,
                         final SecurityAuditRepository audit,
                         final Dhis2ReferenceClient dhis2,
                         final ObjectMapper mapper,
                         final Clock clock) {
        this.events = Objects.requireNonNull(events, "events");
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
            throw new RuntimeException("event pull failed: " + ex.getMessage(), ex);
        }
        int rowsPulled = 0;
        int conflicts = 0;
        Instant maxLastUpdated = null;
        final JsonNode arr = response == null ? null : response.path("events");
        if (arr != null && arr.isArray()) {
            for (final JsonNode e : arr) {
                final MergeOutcome o = mergeOne(e);
                switch (o.action()) {
                    case INSERTED, OVERWRITTEN -> rowsPulled++;
                    case CONFLICT -> conflicts++;
                    case NOOP -> { /* skip */ }
                }
                if (o.lastUpdated() != null
                        && (maxLastUpdated == null || o.lastUpdated().isAfter(maxLastUpdated))) {
                    maxLastUpdated = o.lastUpdated();
                }
            }
        }
        final Instant watermark = maxLastUpdated != null ? maxLastUpdated
                : since != null ? since : Instant.now(clock);
        return new DataPullService.PullerResult(rowsPulled, conflicts, watermark, null);
    }

    private MergeOutcome mergeOne(final JsonNode node) {
        final String eventUid = textOrNull(node, "event");
        final String program  = textOrNull(node, "program");
        final String stage    = textOrNull(node, "programStage");
        final String ou       = textOrNull(node, "orgUnit");
        final String statusS  = textOrNull(node, "status");
        final String occurred = textOrNull(node, "occurredAt");
        final String lu       = textOrNull(node, "lastUpdated");
        if (eventUid == null || program == null || stage == null
                || ou == null || statusS == null || occurred == null) {
            LOG.warn("central event missing required key(s); skipped: {}", node);
            return new MergeOutcome(Action.NOOP, null);
        }
        final UUID eventId;
        try {
            eventId = UUID.fromString(eventUid);
        } catch (IllegalArgumentException ex) {
            LOG.warn("central event uid not a UUID; skipped: {}", eventUid);
            return new MergeOutcome(Action.NOOP, null);
        }
        final Instant watermark = lu == null ? null : parseInstant(lu);
        final Optional<OperationJournalEntry> journalRow = journal.findLatestByEntityRef(
                OperationJournalEntry.EntityType.EVENT, eventUid);
        if (journalRow.isPresent()
                && journalRow.get().state() == OperationJournalEntry.State.CONFLICT_REVIEW) {
            return new MergeOutcome(Action.NOOP, watermark);
        }
        if (journalRow.isPresent() && !isTerminal(journalRow.get().state())) {
            raiseConflict(eventUid, node);
            return new MergeOutcome(Action.CONFLICT, watermark);
        }
        final Optional<Event> existing = events.findById(eventId);
        final boolean wasOverwrite = existing.isPresent();
        final Event centralView = toLocal(eventId, node, existing.orElse(null), watermark);
        events.upsert(centralView);
        if (wasOverwrite) {
            audit.append(new AuditEvent(
                    "DATA_PULL_OVERWRITE",
                    AuditEvent.Outcome.SUCCESS,
                    null, null, null, null,
                    Map.of("entityType", "EVENT", "eventId", eventUid)),
                    Instant.now(clock));
        }
        return new MergeOutcome(wasOverwrite ? Action.OVERWRITTEN : Action.INSERTED, watermark);
    }

    private Event toLocal(final UUID eventId, final JsonNode node, final Event existing,
                            final Instant watermark) {
        final Event.Status status = Event.Status.valueOf(node.get("status").asText());
        final String aoc = textOrNull(node, "attributeOptionCombo");
        final Map<String, String> values = new LinkedHashMap<>();
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
        /* createdBy sentinel UUID(0,0) marks central-pulled rows so
         * downstream audits can tell SYSTEM-origin from operator-origin.
         * Enrollment id is kept null on central-side pulls — Phase 10's
         * graph reconciler threads it through from the surrounding
         * tracker pull. */
        return new Event(
                eventId,
                existing == null ? null : existing.enrollmentId(),
                node.get("program").asText(),
                node.get("programStage").asText(),
                node.get("orgUnit").asText(),
                parseInstantOrNow(node.get("occurredAt").asText()),
                status,
                aoc,
                new UUID(0L, 0L),
                existing == null ? 1 : existing.eventVersion() + 1,
                values,
                null);
    }

    private void raiseConflict(final String entityRef, final JsonNode payload) {
        final JsonNode body;
        try {
            final Map<String, Object> wrap = new HashMap<>();
            wrap.put("centralEvent", payload);
            body = mapper.readTree(mapper.writeValueAsString(wrap));
        } catch (Exception ex) {
            throw new IllegalStateException("failed to serialise conflict payload", ex);
        }
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.EVENT,
                entityRef, body,
                OperationJournalEntry.State.CONFLICT_REVIEW,
                0, "central-pull collision — operator-pending local edit",
                null,
                Instant.now(clock), Instant.now(clock), null, null));
    }

    private static boolean isTerminal(final OperationJournalEntry.State s) {
        return s == OperationJournalEntry.State.CENTRAL_ACCEPTED
                || s == OperationJournalEntry.State.CENTRAL_REJECTED;
    }

    private JsonNode defaultFetch(final String orgUnitUid, final Instant since) throws Exception {
        final String lu = since == null ? "" : "&lastUpdated=" + since.toString();
        return dhis2.fetchJson("/api/events?orgUnit=" + orgUnitUid
                + "&orgUnitMode=DESCENDANTS" + lu);
    }

    private static String textOrNull(final JsonNode n, final String field) {
        final JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static Instant parseInstant(final String s) {
        try {
            return Instant.parse(s);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private Instant parseInstantOrNow(final String s) {
        final Instant i = parseInstant(s);
        return i == null ? Instant.now(clock) : i;
    }

    enum Action { INSERTED, OVERWRITTEN, CONFLICT, NOOP }
    private record MergeOutcome(Action action, Instant lastUpdated) { }
}
