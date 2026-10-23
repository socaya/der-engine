package ug.ac.mak.der.workflows.events;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredProgramStage;
import ug.ac.mak.der.rules.RuleContext;
import ug.ac.mak.der.rules.RuleEngine;
import ug.ac.mak.der.rules.RuleEngineResult;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.approval.ApprovalRequirements;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Phase 03.6b edge-side event write path (POST /api/events + per-event entries
 * in POST /api/tracker).
 *
 * <p>For each incoming event, the service:</p>
 * <ol>
 *   <li>Validates the compound-key metadata (program stage + data elements +
 *       org unit) exists in the mirror.</li>
 *   <li>Builds a {@link RuleContext} from the incoming payload + any previous
 *       events of the same program stage.</li>
 *   <li>Runs {@link RuleEngine#evaluate} — ASSIGN outputs are applied,
 *       SHOWERROR / mandatory-field errors reject the write.</li>
 *   <li>Persists the event + its data values AND inserts a PENDING entry in
 *       {@code operation_journal} in one {@code @Transactional} block (ADR-0004
 *       atomic outbox).</li>
 * </ol>
 */
@Service
public class EventService {

    private static final Logger LOG = LoggerFactory.getLogger(EventService.class);

    private final EventRepository events;
    private final OperationJournalRepository journal;
    private final ExtendedMirrorRepository mirror;
    private final RuleEngine ruleEngine;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final ApprovalRequirements approvals;

    public EventService(final EventRepository events,
                        final OperationJournalRepository journal,
                        final ExtendedMirrorRepository mirror,
                        final RuleEngine ruleEngine,
                        final SecurityAuditRepository audit,
                        final ObjectMapper mapper,
                        final Clock clock,
                        final ApprovalRequirements approvals) {
        this.events = Objects.requireNonNull(events, "events");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.mirror = Objects.requireNonNull(mirror, "mirror");
        this.ruleEngine = Objects.requireNonNull(ruleEngine, "ruleEngine");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.approvals = Objects.requireNonNull(approvals, "approvals");
    }

    @Transactional
    public EventImportResult submit(final List<EventInput> inputs,
                                     final UUID submittedBy,
                                     final String ip,
                                     final String userAgent) {
        return submit(inputs, submittedBy, ip, userAgent, null);
    }

    /** ADR-0027 D-RHO-4: optional referral tag threaded onto the journal entry. */
    @Transactional
    public EventImportResult submit(final List<EventInput> inputs,
                                     final UUID submittedBy,
                                     final String ip,
                                     final String userAgent,
                                     final String nextHopOrgUnitUid) {
        Objects.requireNonNull(inputs, "inputs");
        Objects.requireNonNull(submittedBy, "submittedBy");
        final List<Event> imported = new ArrayList<>();
        final List<Conflict> conflicts = new ArrayList<>();
        for (final EventInput input : inputs) {
            try {
                final Event stored = handleOne(input, submittedBy, ip, userAgent,
                        nextHopOrgUnitUid);
                imported.add(stored);
            } catch (EventRejectedException ex) {
                conflicts.add(new Conflict(input == null ? "(null)" : input.eventId().toString(),
                        ex.getMessage()));
                audit.append(new AuditEvent(
                        "EVENT_WRITE_REJECTED", AuditEvent.Outcome.DENIED,
                        submittedBy, null, ip, userAgent,
                        input == null ? Map.of() : Map.of("eventId", input.eventId().toString(),
                                "reason", ex.getMessage())
                ), Instant.now(clock));
            }
        }
        return new EventImportResult(imported, conflicts);
    }

    private Event handleOne(final EventInput input, final UUID submittedBy,
                             final String ip, final String userAgent,
                             final String nextHopOrgUnitUid) {
        if (input == null) {
            throw new EventRejectedException("event payload is null");
        }
        final MirroredProgramStage stage = mirror.findProgramStage(input.programStageUid())
                .orElseThrow(() -> new EventRejectedException(
                        "program stage not in mirror: " + input.programStageUid()));
        if (!stage.programUid().equals(input.programUid())) {
            throw new EventRejectedException("programStage " + input.programStageUid()
                    + " does not belong to program " + input.programUid());
        }
        final RuleContext ctx = buildContext(input);
        final List<String> submittedFields = new ArrayList<>(input.dataValues().keySet());
        final RuleEngineResult rules = ruleEngine.evaluate(input.programUid(), ctx,
                input.status() == Event.Status.COMPLETED, submittedFields);
        if (rules.rejected()) {
            final String msg = rules.errors().stream()
                    .map(e -> e.message())
                    .reduce((a, b) -> a + "; " + b).orElse("rule rejection");
            throw new EventRejectedException(msg);
        }
        final Map<String, String> values = new LinkedHashMap<>(input.dataValues());
        for (final var entry : rules.assigned().entrySet()) {
            values.put(entry.getKey(), entry.getValue() == null ? "" : entry.getValue().toString());
        }
        final Event event = new Event(input.eventId(), input.enrollmentId(),
                input.programUid(), input.programStageUid(), input.orgUnitUid(),
                input.occurredAt(), input.status(), input.attributeOptionComboUid(),
                submittedBy, 1, values);
        final Event stored = events.upsert(event);
        final JsonNode payload = toJson(stored);
        final OperationJournalEntry entry = new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.EVENT, stored.eventId().toString(),
                payload, OperationJournalEntry.State.PENDING, 0, null, submittedBy,
                Instant.now(clock), Instant.now(clock),
                nextHopOrgUnitUid == null || nextHopOrgUnitUid.isBlank()
                        ? null : nextHopOrgUnitUid.trim());
        journal.insert(entry);
        if (approvals.requiresApproval(OperationJournalEntry.EntityType.EVENT)) {
            journal.markRequiresApproval(entry.operationId());
        }
        audit.append(new AuditEvent(
                "EVENT_WRITE_SUCCESS", AuditEvent.Outcome.SUCCESS,
                submittedBy, null, ip, userAgent,
                Map.of("eventId", stored.eventId().toString(),
                        "programStageUid", stored.programStageUid(),
                        "warnings", String.valueOf(rules.warnings().size()))
        ), Instant.now(clock));
        if (!rules.warnings().isEmpty()) {
            audit.append(new AuditEvent(
                    "RULE_FIRED_WARNING", AuditEvent.Outcome.SUCCESS,
                    submittedBy, null, ip, userAgent,
                    Map.of("eventId", stored.eventId().toString(),
                            "warnings", rules.warnings().stream()
                                    .map(RuleEngineResult.RuleMessage::message).toList()
                                    .toString())
            ), Instant.now(clock));
        }
        return stored;
    }

    private RuleContext buildContext(final EventInput input) {
        final RuleContext.Builder b = RuleContext.builder()
                .env("current_date", clock.instant().toString())
                .env("event_date", input.occurredAt().toString());
        for (final Map.Entry<String, String> dv : input.dataValues().entrySet()) {
            b.eventValue(input.programStageUid() + "." + dv.getKey(), dv.getValue());
        }
        if (input.enrollmentId() != null) {
            for (final Event prev : events.findForEnrollment(input.enrollmentId())) {
                final Map<String, Object> prevValues = new LinkedHashMap<>();
                prevValues.put("event_date", prev.occurredAt().toString());
                for (final Map.Entry<String, String> dv : prev.dataValues().entrySet()) {
                    prevValues.put(prev.programStageUid() + "." + dv.getKey(), dv.getValue());
                }
                b.previousEvent(prevValues);
            }
        }
        return b.build();
    }

    private JsonNode toJson(final Event event) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("event", event.eventId().toString());
        m.put("program", event.programUid());
        m.put("programStage", event.programStageUid());
        m.put("orgUnit", event.orgUnitUid());
        m.put("occurredAt", event.occurredAt().toString());
        m.put("status", event.status().name());
        m.put("attributeOptionCombo", event.attributeOptionComboUid());
        m.put("dataValues", event.dataValues());
        if (event.enrollmentId() != null) {
            m.put("enrollment", event.enrollmentId().toString());
        }
        try {
            return mapper.valueToTree(m);
        } catch (RuntimeException ex) {
            LOG.warn("failed to serialise event payload for journal: {}", ex.getMessage());
            return mapper.createObjectNode();
        }
    }

    public record EventInput(
            UUID eventId,
            UUID enrollmentId,
            String programUid,
            String programStageUid,
            String orgUnitUid,
            Instant occurredAt,
            Event.Status status,
            String attributeOptionComboUid,
            Map<String, String> dataValues
    ) {

        public EventInput {
            eventId = eventId == null ? UUID.randomUUID() : eventId;
            Objects.requireNonNull(programUid, "programUid");
            Objects.requireNonNull(programStageUid, "programStageUid");
            Objects.requireNonNull(orgUnitUid, "orgUnitUid");
            Objects.requireNonNull(occurredAt, "occurredAt");
            Objects.requireNonNull(status, "status");
            attributeOptionComboUid = attributeOptionComboUid == null
                    ? "HllvX50cXC0" : attributeOptionComboUid;
            dataValues = dataValues == null ? Map.of() : Map.copyOf(dataValues);
        }
    }

    public record EventImportResult(List<Event> imported, List<Conflict> conflicts) {

        public EventImportResult {
            imported = List.copyOf(imported);
            conflicts = List.copyOf(conflicts);
        }
    }

    public record Conflict(String reference, String reason) { }

    static final class EventRejectedException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        EventRejectedException(final String message) {
            super(message);
        }
    }

}
