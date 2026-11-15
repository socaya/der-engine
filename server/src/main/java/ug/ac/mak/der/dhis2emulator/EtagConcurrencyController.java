package ug.ac.mak.der.dhis2emulator;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventRepository;
import ug.ac.mak.der.workflows.events.EventService;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity;

/**
 * DER-APPS-DHIS2-001 FR-EMU-005 — If-Match / ETag optimistic
 * concurrency on DHIS2-shaped single-row endpoints:
 *
 * <ul>
 *   <li>{@code GET /api/events/{id}} → {@code ETag: "<version>"}
 *       alongside the event JSON.</li>
 *   <li>{@code DELETE /api/events/{id}} → honours {@code If-Match};
 *       412 on mismatch.</li>
 *   <li>{@code GET /api/trackedEntityInstances/{id}} → ETag header.</li>
 *   <li>{@code DELETE /api/trackedEntityInstances/{id}} → If-Match.</li>
 * </ul>
 *
 * <p>The ETag token is DHIS2's monotonic version column
 * ({@code eventVersion} / {@code teiVersion}) wrapped in double
 * quotes per RFC 7232. If-Match is optional — callers that don't
 * send it keep the pre-FR-EMU-005 behaviour. This is intentional:
 * DHIS2 clients that don't care about concurrency can still delete,
 * and the old DELETE path on {@link EventsController} keeps working
 * (Spring MVC picks the more specific mapping; see the mapping
 * check in {@link #deleteEventMapping()}).</p>
 */
@RestController
public class EtagConcurrencyController {

    private final EventRepository events;
    private final EventService eventService;
    private final TrackedEntityRepository trackedEntities;
    private final OperationJournalRepository journal;
    private final ObjectMapper jsonMapper;
    private final Clock clock;

    public EtagConcurrencyController(final EventRepository events,
                                        final EventService eventService,
                                        final TrackedEntityRepository trackedEntities,
                                        final OperationJournalRepository journal,
                                        final ObjectMapper jsonMapper,
                                        final Clock clock) {
        this.events = Objects.requireNonNull(events, "events");
        this.eventService = Objects.requireNonNull(eventService, "eventService");
        this.trackedEntities = Objects.requireNonNull(trackedEntities, "trackedEntities");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    // ---- events -------------------------------------------------------

    @GetMapping(path = "/api/events/{eventId}",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getEvent(
            @PathVariable("eventId") final String eventIdString) {
        final UUID eventId;
        try {
            eventId = UUID.fromString(eventIdString);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        }
        final Optional<Event> found = events.findById(eventId);
        if (found.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return withEtag(toEventJson(found.get()),
                etag(found.get().eventVersion()));
    }

    /** DHIS2-shape delete with optional If-Match. The pre-existing
     *  path on {@link EventsController} still fires when
     *  {@code If-Match} is absent — this one wins via Spring's more
     *  specific header-matched mapping. Returns 412 on mismatch. */
    @DeleteMapping(path = "/api/events/{eventId}",
            headers = "If-Match",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> deleteEventWithIfMatch(
            @PathVariable("eventId") final String eventIdString,
            @RequestHeader("If-Match") final String ifMatch,
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final UUID eventId;
        try {
            eventId = UUID.fromString(eventIdString);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        }
        final Optional<Event> existing = events.findById(eventId);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final String current = etag(existing.get().eventVersion());
        if (!matches(ifMatch, current)) {
            return preconditionFailed("/api/events/" + eventIdString, current);
        }
        final boolean deleted = eventService.deleteEvent(eventId);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        enqueueEventDeleteTombstone(existing.get(), principal.userId());
        return ResponseEntity.ok(Map.of("deleted", true,
                "eventId", eventIdString));
    }

    private void enqueueEventDeleteTombstone(final Event e, final UUID actor) {
        final ObjectNode payload = jsonMapper.createObjectNode();
        payload.put("eventId", e.eventId().toString());
        if (e.enrollmentId() != null) {
            payload.put("enrollmentId", e.enrollmentId().toString());
        }
        payload.put("program", e.programUid());
        payload.put("programStage", e.programStageUid());
        payload.put("orgUnit", e.orgUnitUid());
        payload.put("occurredAt", e.occurredAt().toString());
        payload.put("operation", "DELETE");
        final Instant now = Instant.now(clock);
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT,
                e.eventId().toString(),
                payload,
                OperationJournalEntry.State.PENDING,
                0, null, actor, now, now, null, e.workflowRunId()));
    }

    // ---- tracked entity instances -------------------------------------

    @GetMapping(path = "/api/trackedEntityInstances/{teiUid}",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getTei(
            @PathVariable("teiUid") final String teiUid) {
        final Optional<TrackedEntity> found = trackedEntities.findById(teiUid);
        if (found.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return withEtag(toTeiJson(found.get()),
                etag(found.get().teiVersion()));
    }

    /**
     * DER-APPS-DHIS2-001 FR-EMU-005 — PUT with optional If-Match on
     * the DHIS2 TEI single-row surface. {@code orgUnit} + {@code
     * trackedEntityType} + {@code attributes} are the mutable body
     * fields; identity ({@code teiUid}, {@code createdBy},
     * {@code createdAt}) is immutable and sourced from the stored
     * row.
     *
     * <p>Request body shape (DHIS2-ish):
     * <pre>
     *   {
     *     "orgUnit": "...",
     *     "trackedEntityType": "...",
     *     "attributes": [
     *       { "attribute": "...", "value": "..." },
     *       ...
     *     ]
     *   }
     * </pre>
     * The {@code attributes} field may also be sent as the flat
     * {@code { attr-id: value }} map; both forms map to the
     * {@code tracked_entity.attributes} JSONB column.</p>
     *
     * <p>412 on stale If-Match, 409 when body re-asserts an
     * immutable field with a conflicting value, 404 on unknown TEI.
     * The repository upsert bumps {@code tei_version} on conflict
     * so the response ETag reflects the post-write state.</p>
     */
    @PutMapping(path = "/api/trackedEntityInstances/{teiUid}",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> putTei(
            @PathVariable("teiUid") final String teiUid,
            @RequestHeader(value = "If-Match", required = false) final String ifMatch,
            @RequestBody(required = false) final Map<String, Object> body,
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "BODY_REQUIRED",
                    "message", "request body is required"));
        }
        final Optional<TrackedEntity> existing = trackedEntities.findById(teiUid);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final String currentEtag = etag(existing.get().teiVersion());
        if (ifMatch != null && !matches(ifMatch, currentEtag)) {
            return preconditionFailed(
                    "/api/trackedEntityInstances/" + teiUid, currentEtag);
        }
        // Immutable fields: a client that submits them must match the
        // stored row. Mismatch → 409. This keeps the handler from
        // silently reassigning identity.
        final String bodyType = asString(body.get("trackedEntityType"));
        final String bodyOu = asString(body.get("orgUnit"));
        if (bodyType != null
                && !bodyType.equals(existing.get().trackedEntityType())) {
            return conflict("trackedEntityType is immutable");
        }
        final String nextOu = bodyOu != null ? bodyOu : existing.get().orgUnitUid();
        final Map<String, String> nextAttrs = parseAttributes(body.get("attributes"),
                existing.get().attributes());
        final TrackedEntity next = new TrackedEntity(
                existing.get().teiUid(),
                existing.get().trackedEntityType(),
                nextOu,
                nextAttrs,
                existing.get().createdBy(),
                existing.get().createdAt(),
                java.time.Instant.now(clock),
                existing.get().teiVersion(),
                existing.get().workflowRunId());
        trackedEntities.upsert(next);
        final TrackedEntity after = trackedEntities.findById(teiUid)
                .orElseThrow(() -> new IllegalStateException(
                        "tei vanished between upsert and refetch: " + teiUid));
        // Journal — update, not delete; keeps DER's write pipeline
        // honest about who edited what, same pattern as the DELETE
        // paths further up.
        enqueueTeiUpdateTombstone(after, principal.userId());
        return withEtag(toTeiJson(after), etag(after.teiVersion()));
    }

    private void enqueueTeiUpdateTombstone(final TrackedEntity t, final UUID actor) {
        final ObjectNode payload = jsonMapper.createObjectNode();
        payload.put("teiUid", t.teiUid());
        payload.put("trackedEntityType", t.trackedEntityType());
        payload.put("orgUnit", t.orgUnitUid());
        payload.put("operation", "UPDATE");
        payload.put("teiVersion", t.teiVersion());
        final Instant now = Instant.now(clock);
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.TRACKED_ENTITY,
                t.teiUid(),
                payload,
                OperationJournalEntry.State.PENDING,
                0, null, actor, now, now, null, t.workflowRunId()));
    }

    /** Accepts either the DHIS2 array-of-objects form (every element
     *  {@code { attribute, value }}) or the flat JSON object form
     *  ({@code { attr-id: value }}). Missing attributes retain their
     *  stored value — DHIS2 PUT semantics are strictly replace, but
     *  DER treats absent attributes as "leave alone" so a partial
     *  edit from a workflow screen doesn't wipe the rest. */
    @SuppressWarnings("unchecked")
    private static Map<String, String> parseAttributes(final Object raw,
                                                         final Map<String, String> current) {
        final Map<String, String> out = new java.util.LinkedHashMap<>(current);
        if (raw instanceof List<?> list) {
            for (final Object item : list) {
                if (!(item instanceof Map)) {
                    continue;
                }
                final Map<String, Object> row = (Map<String, Object>) item;
                final String id = asString(row.get("attribute"));
                if (id == null || id.isBlank()) {
                    continue;
                }
                final String val = asString(row.get("value"));
                out.put(id, val == null ? "" : val);
            }
        } else if (raw instanceof Map<?, ?> map) {
            for (final var entry : map.entrySet()) {
                final String id = String.valueOf(entry.getKey());
                if (id == null || id.isBlank()) {
                    continue;
                }
                final Object val = entry.getValue();
                out.put(id, val == null ? "" : val.toString());
            }
        }
        return out;
    }

    private static String asString(final Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static ResponseEntity<Map<String, Object>> conflict(final String message) {
        return ResponseEntity.status(409).body(Map.of(
                "httpStatus", "Conflict",
                "httpStatusCode", 409,
                "status", "ERROR",
                "code", "IMMUTABLE_FIELD",
                "message", message));
    }

    @DeleteMapping(path = "/api/trackedEntityInstances/{teiUid}",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> deleteTei(
            @PathVariable("teiUid") final String teiUid,
            @RequestHeader(value = "If-Match", required = false) final String ifMatch,
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<TrackedEntity> existing = trackedEntities.findById(teiUid);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final String current = etag(existing.get().teiVersion());
        if (ifMatch != null && !matches(ifMatch, current)) {
            return preconditionFailed(
                    "/api/trackedEntityInstances/" + teiUid, current);
        }
        trackedEntities.delete(teiUid);
        enqueueTeiDeleteTombstone(existing.get(), principal.userId());
        return ResponseEntity.ok(Map.of("deleted", true, "teiUid", teiUid));
    }

    private void enqueueTeiDeleteTombstone(final TrackedEntity t, final UUID actor) {
        final ObjectNode payload = jsonMapper.createObjectNode();
        payload.put("teiUid", t.teiUid());
        payload.put("trackedEntityType", t.trackedEntityType());
        payload.put("orgUnit", t.orgUnitUid());
        payload.put("operation", "DELETE");
        final Instant now = Instant.now(clock);
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.TRACKED_ENTITY,
                t.teiUid(),
                payload,
                OperationJournalEntry.State.PENDING,
                0, null, actor, now, now, null, t.workflowRunId()));
    }

    // ---- helpers ------------------------------------------------------

    /** The ETag we emit on {@code GET} and compare on {@code If-Match}.
     *  Monotonic version column wrapped in double quotes per RFC 7232. */
    static String etag(final int version) {
        return "\"" + version + "\"";
    }

    /** RFC 7232 If-Match matcher. A client may send {@code "<etag>"},
     *  the bare value, a wildcard {@code *}, or a comma-separated list.
     *  Mismatch is tolerant: we strip optional weak-validator and
     *  surrounding quotes before comparison. */
    static boolean matches(final String ifMatch, final String etag) {
        if (ifMatch == null) {
            return false;
        }
        final String want = stripQuotes(etag);
        for (final String part : ifMatch.split(",")) {
            final String candidate = stripQuotes(part.trim());
            if ("*".equals(candidate) || want.equals(candidate)) {
                return true;
            }
        }
        return false;
    }

    private static String stripQuotes(final String raw) {
        if (raw == null) {
            return "";
        }
        String s = raw.trim();
        if (s.startsWith("W/")) {
            s = s.substring(2).trim();
        }
        if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) {
            s = s.substring(1, s.length() - 1);
        }
        return s;
    }

    private static ResponseEntity<Map<String, Object>> withEtag(
            final Map<String, Object> body, final String etag) {
        return ResponseEntity.ok()
                .header(HttpHeaders.ETAG, etag)
                .body(body);
    }

    private static ResponseEntity<Map<String, Object>> preconditionFailed(
            final String endpoint, final String current) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("httpStatus", "PreconditionFailed");
        m.put("httpStatusCode", 412);
        m.put("status", "ERROR");
        m.put("code", "STALE_ETAG");
        m.put("endpoint", endpoint);
        m.put("message",
                "If-Match did not match the current version. Re-fetch "
                        + "to get the latest ETag before retrying.");
        return ResponseEntity.status(412)
                .header(HttpHeaders.ETAG, current)
                .body(m);
    }

    private static Map<String, Object> toEventJson(final Event e) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("event", e.eventId().toString());
        m.put("program", e.programUid());
        m.put("programStage", e.programStageUid());
        m.put("orgUnit", e.orgUnitUid());
        m.put("occurredAt", e.occurredAt().toString());
        m.put("status", e.status().name());
        m.put("attributeOptionCombo", e.attributeOptionComboUid());
        if (e.enrollmentId() != null) {
            m.put("enrollment", e.enrollmentId().toString());
        }
        final List<Map<String, Object>> dvs = new ArrayList<>();
        for (final var dv : e.dataValues().entrySet()) {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("dataElement", dv.getKey());
            row.put("value", dv.getValue());
            dvs.add(row);
        }
        m.put("dataValues", dvs);
        m.put("eventVersion", e.eventVersion());
        return m;
    }

    private static Map<String, Object> toTeiJson(final TrackedEntity t) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("trackedEntityInstance", t.teiUid());
        m.put("trackedEntityType", t.trackedEntityType());
        m.put("orgUnit", t.orgUnitUid());
        final List<Map<String, Object>> attrs = new ArrayList<>();
        for (final var a : t.attributes().entrySet()) {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("attribute", a.getKey());
            row.put("value", a.getValue());
            attrs.add(row);
        }
        m.put("attributes", attrs);
        m.put("created", t.createdAt().toString());
        m.put("lastUpdated", t.updatedAt().toString());
        m.put("teiVersion", t.teiVersion());
        return m;
    }

    /** Dead reference used only by the Javadoc above to anchor the
     *  "more specific mapping" note Spring exploits — the actual
     *  mapping is defined by the {@code @DeleteMapping} on the
     *  {@code deleteEventWithIfMatch} handler. */
    @SuppressWarnings("unused")
    private void deleteEventMapping() { }
}
