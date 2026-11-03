package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;
import ug.ac.mak.der.workflows.drafts.Draft;
import ug.ac.mak.der.workflows.drafts.DraftRepository;
import ug.ac.mak.der.workflows.events.EventService;
import ug.ac.mak.der.workflows.tracker.Enrollment;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackerEvent;
import ug.ac.mak.der.workflows.tracker.TrackerService;

/** DC-17 server surface — the signed-in user's drafts. */
@RestController
@RequestMapping(path = "/edge-api/v1/drafts", produces = MediaType.APPLICATION_JSON_VALUE)
public class DraftController {

    private final DraftRepository drafts;
    private final AggregateDataValueService aggregates;
    private final EventService events;
    private final TrackerService tracker;
    private final ObjectMapper mapper;

    public DraftController(final DraftRepository drafts,
                            final AggregateDataValueService aggregates,
                            final EventService events,
                            final TrackerService tracker,
                            final ObjectMapper mapper) {
        this.drafts = Objects.requireNonNull(drafts, "drafts");
        this.aggregates = Objects.requireNonNull(aggregates, "aggregates");
        this.events = Objects.requireNonNull(events, "events");
        this.tracker = Objects.requireNonNull(tracker, "tracker");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(final Authentication authentication,
                                                      @org.springframework.web.bind.annotation.RequestParam(
                                                          name = "workflowRunId", required = false)
                                                      final String workflowRunIdParam) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        UUID runFilter = null;
        if (workflowRunIdParam != null && !workflowRunIdParam.isBlank()) {
            try {
                runFilter = UUID.fromString(workflowRunIdParam);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "workflowRunId must be a UUID"));
            }
        }
        final List<Draft> rows = drafts.findByOwner(principal.userId(), runFilter);
        return ResponseEntity.ok(Map.of("drafts", rows.stream().map(DraftController::toJson).toList()));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upsert(final Authentication authentication,
                                                        @RequestBody final SaveRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.kind() == null || body.kind().isBlank()
                || body.title() == null || body.title().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "kind + title required"));
        }
        final Draft existing = body.draftId() == null ? null
                : drafts.findById(body.draftId()).filter(d -> d.ownerId().equals(principal.userId()))
                        .orElse(null);
        final Draft toSave = existing == null
                ? DraftRepository.create(principal.userId(), body.kind(), body.title(),
                        body.payload())
                : new Draft(existing.draftId(), existing.ownerId(), body.kind(), body.title(),
                        body.payload(), existing.createdAt(), existing.updatedAt());
        return ResponseEntity.ok(toJson(drafts.upsert(toSave)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(final Authentication authentication,
                                         @PathVariable("id") final UUID id) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<Draft> row = drafts.findById(id);
        if (row.isEmpty() || !row.get().ownerId().equals(principal.userId())) {
            return ResponseEntity.notFound().build();
        }
        drafts.delete(id, principal.userId());
        return ResponseEntity.noContent().build();
    }

    /**
     * Phase 07.1 — publish a draft into the outbound journal.
     *
     * <p>The draft's {@code payload} is deserialised into the input
     * list for the service matched by {@code kind}:</p>
     * <ul>
     *   <li>{@code aggregate} → {@link AggregateDataValueService#submit(List, UUID, String, String)}
     *       with payload shape {@code { "inputs": [DataValueInput, ...] }}.</li>
     *   <li>{@code event} → {@link EventService#submit(List, UUID, String, String)}
     *       with payload shape {@code { "inputs": [EventInput, ...] }}.</li>
     * </ul>
     *
     * <p>On success the draft row is deleted and the response carries
     * the number of imported rows plus the conflicts list (if any).
     * On validation / mirror / rule rejection the draft is kept so
     * the operator can edit and retry; the response reflects the
     * import summary unchanged.</p>
     *
     * <p>Tracker-shaped drafts (TEI + enrolment + event combos) are
     * out of scope here — {@code TrackerService} does not expose a
     * single submit entry today. Phase 10 revisits.</p>
     */
    @PostMapping("/{id}/publish")
    public ResponseEntity<Map<String, Object>> publish(final Authentication authentication,
                                                         @PathVariable("id") final UUID id,
                                                         final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<Draft> row = drafts.findById(id);
        if (row.isEmpty() || !row.get().ownerId().equals(principal.userId())) {
            return ResponseEntity.notFound().build();
        }
        final Draft draft = row.get();
        final String ip = http.getRemoteAddr();
        final String ua = http.getHeader("User-Agent");

        return switch (draft.kind()) {
            case "aggregate" -> publishAggregate(draft, principal.userId(), ip, ua);
            case "event"     -> publishEvent(draft, principal.userId(), ip, ua);
            case "tracker-tei",
                 "tracker-enrollment",
                 "tracker-event"
                             -> publishTracker(draft, principal.userId(), ip, ua);
            default -> ResponseEntity.badRequest().body(Map.of(
                    "code", "DRAFT_KIND_NOT_PUBLISHABLE",
                    "kind", draft.kind(),
                    "message", "unknown draft kind — supported: aggregate, event, "
                            + "tracker-tei, tracker-enrollment, tracker-event"));
        };
    }

    /**
     * Phase 14.3 — tracker draft publishing. Three sub-kinds mapping
     * one-to-one onto {@link TrackerService}'s three upsert entry
     * points:
     * <ul>
     *   <li>{@code tracker-tei} — payload {@code {tei: TrackedEntity}}
     *     → {@link TrackerService#upsertTei}</li>
     *   <li>{@code tracker-enrollment} — payload
     *     {@code {enrollment: Enrollment}} →
     *     {@link TrackerService#upsertEnrollment}</li>
     *   <li>{@code tracker-event} — payload
     *     {@code {event: TrackerEvent}} →
     *     {@link TrackerService#upsertEvent}</li>
     * </ul>
     *
     * <p>The three kinds are published separately rather than
     * composed into one atomic bundle so operators can resume after
     * a parent fails (e.g. tracker-tei saved, tracker-enrollment
     * saved, operator fixes the event's broken dataElement value,
     * re-publishes just the tracker-event). Graph constraints
     * (enrol references existing TEI, event references existing
     * enrol) are enforced by the TrackerService upserts
     * themselves — not re-implemented here.</p>
     */
    private ResponseEntity<Map<String, Object>> publishTracker(
            final Draft draft, final UUID actingUser, final String ip, final String ua) {
        try {
            switch (draft.kind()) {
                case "tracker-tei" -> {
                    final TrackedEntityRepository.TrackedEntity tei = mapper.convertValue(
                            draft.payload().path("tei"),
                            TrackedEntityRepository.TrackedEntity.class);
                    if (tei == null) {
                        return trackerPayloadInvalid("tracker-tei",
                                "{\"tei\":TrackedEntity}");
                    }
                    tracker.upsertTei(tei, actingUser, ip, ua);
                }
                case "tracker-enrollment" -> {
                    final Enrollment en = mapper.convertValue(
                            draft.payload().path("enrollment"), Enrollment.class);
                    if (en == null) {
                        return trackerPayloadInvalid("tracker-enrollment",
                                "{\"enrollment\":Enrollment}");
                    }
                    tracker.upsertEnrollment(en, actingUser, ip, ua);
                }
                case "tracker-event" -> {
                    final TrackerEvent ev = mapper.convertValue(
                            draft.payload().path("event"), TrackerEvent.class);
                    if (ev == null) {
                        return trackerPayloadInvalid("tracker-event",
                                "{\"event\":TrackerEvent}");
                    }
                    tracker.upsertEvent(ev, actingUser, ip, ua);
                }
                default -> {
                    /* unreachable — publish() filters above */
                    return ResponseEntity.badRequest().body(Map.of(
                            "code", "DRAFT_KIND_NOT_PUBLISHABLE"));
                }
            }
        } catch (RuntimeException ex) {
            /* Validation / mirror / referential-integrity failure.
             * Keep the draft so the operator can fix the problem; let
             * them see the error so they know what to fix. */
            return ResponseEntity.status(409).body(Map.of(
                    "code", "DRAFT_TRACKER_REJECTED",
                    "kind", draft.kind(),
                    "message", String.valueOf(ex.getMessage())));
        }
        drafts.delete(draft.draftId(), actingUser);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("draftId", draft.draftId().toString());
        body.put("kind", draft.kind());
        body.put("imported", 1);
        body.put("conflicts", List.of());
        body.put("draftConsumed", true);
        return ResponseEntity.ok(body);
    }

    /**
     * Phase 14.5b — bulk draft publish. Operators approving a batch of
     * drafts (e.g. end-of-day weekly aggregate totals captured across
     * 20 forms) call this once with every draft id, get a per-draft
     * result array back, and move on. Max 100 entries; partial-success
     * semantics — one draft failure doesn't abort the batch.
     */
    @PostMapping("/publish-batch")
    public ResponseEntity<Map<String, Object>> publishBatch(final Authentication authentication,
                                                              @RequestBody final BatchPublishRequest body,
                                                              final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.draftIds() == null || body.draftIds().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "BATCH_EMPTY",
                    "message", "draftIds[] required"));
        }
        if (body.draftIds().size() > 100) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "BATCH_TOO_LARGE",
                    "message", "max 100 drafts per batch"));
        }
        final List<Map<String, Object>> results = new java.util.ArrayList<>();
        int consumed = 0;
        int kept = 0;
        for (final UUID draftId : body.draftIds()) {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("draftId", draftId == null ? null : draftId.toString());
            if (draftId == null) {
                row.put("status", "FAILED");
                row.put("error", "null draftId");
                results.add(row);
                continue;
            }
            try {
                final ResponseEntity<Map<String, Object>> single =
                        publish(authentication, draftId, http);
                final Map<String, Object> singleBody = single.getBody();
                if (single.getStatusCode().is2xxSuccessful() && singleBody != null) {
                    row.put("status", "PUBLISHED");
                    row.put("imported", singleBody.get("imported"));
                    row.put("conflicts", singleBody.get("conflicts"));
                    row.put("draftConsumed", singleBody.get("draftConsumed"));
                    if (Boolean.TRUE.equals(singleBody.get("draftConsumed"))) {
                        consumed++;
                    } else {
                        kept++;
                    }
                } else {
                    row.put("status", "FAILED");
                    row.put("httpStatus", single.getStatusCode().value());
                    if (singleBody != null) {
                        row.put("error", singleBody.getOrDefault("message", singleBody));
                    }
                    kept++;
                }
            } catch (RuntimeException ex) {
                row.put("status", "FAILED");
                row.put("error", ex.getMessage());
                kept++;
            }
            results.add(row);
        }
        final Map<String, Object> response = new LinkedHashMap<>();
        response.put("consumed", consumed);
        response.put("kept", kept);
        response.put("results", results);
        return ResponseEntity.ok(response);
    }

    public record BatchPublishRequest(
            @JsonProperty("draftIds") List<UUID> draftIds
    ) { }

    private ResponseEntity<Map<String, Object>> trackerPayloadInvalid(
            final String kind, final String expectedShape) {
        return ResponseEntity.badRequest().body(Map.of(
                "code", "DRAFT_PAYLOAD_INVALID",
                "kind", kind,
                "message", kind + " draft payload must be " + expectedShape));
    }

    private ResponseEntity<Map<String, Object>> publishAggregate(
            final Draft draft, final UUID actingUser, final String ip, final String ua) {
        final List<AggregateDataValueService.DataValueInput> inputs;
        try {
            final JsonNode listNode = draft.payload().path("inputs");
            if (!listNode.isArray()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "DRAFT_PAYLOAD_INVALID",
                        "message", "aggregate draft payload must be "
                                + "{\"inputs\":[DataValueInput, ...]}"));
            }
            inputs = mapper.convertValue(listNode,
                    new TypeReference<List<AggregateDataValueService.DataValueInput>>() { });
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "DRAFT_PAYLOAD_INVALID",
                    "message", "failed to deserialise draft payload: " + ex.getMessage()));
        }
        final AggregateDataValueService.ImportSummary summary = aggregates.submit(
                inputs, actingUser, ip, ua);
        final boolean fullyAccepted = summary.ignored() == 0 && !inputs.isEmpty();
        if (fullyAccepted) {
            drafts.delete(draft.draftId(), actingUser);
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("draftId", draft.draftId().toString());
        body.put("kind", draft.kind());
        body.put("imported", summary.imported());
        body.put("ignored", summary.ignored());
        body.put("conflicts", summary.conflicts());
        body.put("draftConsumed", fullyAccepted);
        return ResponseEntity.ok(body);
    }

    private ResponseEntity<Map<String, Object>> publishEvent(
            final Draft draft, final UUID actingUser, final String ip, final String ua) {
        final List<EventService.EventInput> inputs;
        try {
            final JsonNode listNode = draft.payload().path("inputs");
            if (!listNode.isArray()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "DRAFT_PAYLOAD_INVALID",
                        "message", "event draft payload must be "
                                + "{\"inputs\":[EventInput, ...]}"));
            }
            inputs = mapper.convertValue(listNode,
                    new TypeReference<List<EventService.EventInput>>() { });
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "DRAFT_PAYLOAD_INVALID",
                    "message", "failed to deserialise draft payload: " + ex.getMessage()));
        }
        final EventService.EventImportResult result = events.submit(
                inputs, actingUser, ip, ua);
        final boolean fullyAccepted = result.conflicts().isEmpty() && !inputs.isEmpty();
        if (fullyAccepted) {
            drafts.delete(draft.draftId(), actingUser);
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("draftId", draft.draftId().toString());
        body.put("kind", draft.kind());
        body.put("imported", result.imported().size());
        body.put("conflicts", result.conflicts());
        body.put("draftConsumed", fullyAccepted);
        return ResponseEntity.ok(body);
    }

    private static Map<String, Object> toJson(final Draft d) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("draftId", d.draftId().toString());
        m.put("kind", d.kind());
        m.put("title", d.title());
        m.put("payload", d.payload());
        m.put("updatedAt", d.updatedAt().toString());
        return m;
    }

    public record SaveRequest(
            @JsonProperty("draftId") UUID draftId,
            @JsonProperty("kind") String kind,
            @JsonProperty("title") String title,
            @JsonProperty("payload") JsonNode payload
    ) { }
}
