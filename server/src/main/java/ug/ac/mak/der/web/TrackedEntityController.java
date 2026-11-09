package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.SystemWorkflowService;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity;
import ug.ac.mak.der.workflows.tracker.TrackerService;

/**
 * FR-08-01 (create/update) + FR-08-02 (search). Minimal tracker TEI
 * surface — the full tracker enrollment / stage event lifecycle is
 * post-2.0.1. This controller gives capture clients a persistent
 * TEI store with stable identity + authorised search.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/tracked-entities",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class TrackedEntityController {

    private final TrackedEntityRepository repo;
    private final TrackerService trackerService;
    private final SystemWorkflowService systemWorkflows;
    private final OperationJournalRepository journal;
    private final ObjectMapper jsonMapper;
    private final Clock clock;

    public TrackedEntityController(final TrackedEntityRepository repo,
                                     final TrackerService trackerService,
                                     final SystemWorkflowService systemWorkflows,
                                     final OperationJournalRepository journal,
                                     final ObjectMapper jsonMapper,
                                     final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.trackerService = Objects.requireNonNull(trackerService, "trackerService");
        this.systemWorkflows = Objects.requireNonNull(systemWorkflows, "systemWorkflows");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** FR-08-01: create or update a TEI with required attributes + stable UID.
     *
     *  §2.3.96 R-D/tracker-svc — thin controller: validate body +
     *  derive the TRACKER_CAPTURE system run, then delegate the
     *  storage + journal insert to {@link TrackerService} which
     *  wraps them in one {@code @Transactional} unit so partial
     *  failures can't leave an orphaned row. */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upsert(final Authentication authentication,
                                                        @RequestBody final TeiRequest body,
                                                        final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.trackedEntityType() == null
                || body.orgUnit() == null || body.orgUnit().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "TEI_INVALID",
                    "message", "trackedEntityType + orgUnit required"));
        }
        final String teiUid = body.teiUid() == null || body.teiUid().isBlank()
                ? generateDhis2Uid()
                : body.teiUid().trim();
        final Instant now = Instant.now(clock);
        final java.util.UUID runId = systemWorkflows.ensureTrackerCaptureRun(
                "_TEI_", body.orgUnit(), principal.userId());
        final TrackedEntity stored = trackerService.upsertTei(
                new TrackedEntity(
                    teiUid, body.trackedEntityType(), body.orgUnit(),
                    body.attributes() == null ? Map.of() : body.attributes(),
                    principal.userId(), now, now, 1, runId),
                principal.userId(),
                http == null ? null : http.getRemoteAddr(),
                http == null ? null : http.getHeader(HttpHeaders.USER_AGENT));
        return ResponseEntity.ok(toJson(stored));
    }

    /** FR-08-02: search by indexed authorised fields.
     *
     *  <p>Accepts an optional {@code program} filter that mirrors
     *  DHIS2's {@code /api/tracker/trackedEntities?program=X}
     *  semantics: only TEIs with an enrollment in the given program
     *  are returned. Without it, programs that share a tracked-entity
     *  type would surface the same TEI on every program's list, which
     *  diverges from DHIS2 — the capture client relies on the DHIS2
     *  behaviour to keep program working-lists isolated.</p> */
    @GetMapping
    public ResponseEntity<Map<String, Object>> search(
            @RequestParam(required = false) final String trackedEntityType,
            @RequestParam(required = false) final String orgUnit,
            @RequestParam(required = false) final String program,
            @RequestParam(required = false) final String attributeId,
            @RequestParam(required = false) final String attributeValue,
            @RequestParam(defaultValue = "50") final int limit) {
        final Map<String, String> filter = attributeId == null || attributeValue == null
                ? Map.of() : Map.of(attributeId, attributeValue);
        final List<TrackedEntity> hits = repo.search(trackedEntityType, orgUnit,
                filter, limit, program);
        return ResponseEntity.ok(Map.of(
                "trackedEntities", hits.stream()
                        .map(TrackedEntityController::toJson).toList(),
                "count", hits.size()));
    }

    @GetMapping("/{teiUid}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable("teiUid") final String teiUid) {
        return repo.findById(teiUid)
                .<ResponseEntity<Map<String, Object>>>map(t -> ResponseEntity.ok(toJson(t)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Delete a TEI on the edge AND enqueue a journal tombstone so
     *  the drain POSTs the matching DELETE to central
     *  (/api/tracker?importStrategy=DELETE). Same pattern as the
     *  event + enrolment tombstones — payload carries just the
     *  identity fields the publisher needs to build the DHIS2
     *  envelope. */
    @DeleteMapping("/{teiUid}")
    public ResponseEntity<Map<String, Object>> delete(
            final Authentication authentication,
            @PathVariable("teiUid") final String teiUid) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final TrackedEntity existing = repo.findById(teiUid).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        repo.delete(teiUid);
        enqueueDeleteTombstone(existing, principal.userId());
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    private void enqueueDeleteTombstone(final TrackedEntity t,
                                         final java.util.UUID actor) {
        final ObjectNode payload = jsonMapper.createObjectNode();
        payload.put("teiUid", t.teiUid());
        payload.put("trackedEntityType", t.trackedEntityType());
        payload.put("orgUnit", t.orgUnitUid());
        payload.put("operation", "DELETE");
        final Instant now = Instant.now(clock);
        journal.insert(new OperationJournalEntry(
                java.util.UUID.randomUUID(),
                OperationJournalEntry.EntityType.TRACKED_ENTITY,
                t.teiUid(),
                payload,
                OperationJournalEntry.State.PENDING,
                0, null, actor, now, now, null, t.workflowRunId()));
    }

    private static Map<String, Object> toJson(final TrackedEntity t) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("teiUid", t.teiUid());
        m.put("trackedEntityType", t.trackedEntityType());
        m.put("orgUnit", t.orgUnitUid());
        m.put("attributes", t.attributes());
        m.put("createdBy", t.createdBy() == null ? null : t.createdBy().toString());
        m.put("createdAt", t.createdAt().toString());
        m.put("updatedAt", t.updatedAt().toString());
        m.put("teiVersion", t.teiVersion());
        return m;
    }

    public record TeiRequest(
            @JsonProperty("teiUid") String teiUid,
            @JsonProperty("trackedEntityType") String trackedEntityType,
            @JsonProperty("orgUnit") String orgUnit,
            @JsonProperty("attributes") Map<String, String> attributes) { }

    /** DHIS2 UID — 11 chars matching [A-Za-z][A-Za-z0-9]{10}. The
     *  previous default (java.util.UUID.toString) produced 36-char
     *  UUIDs which DHIS2 central rejects with HTTP 400 on every
     *  /api/tracker write. Clients may still pre-mint their own UID
     *  for optimistic UI; this only kicks in when the body omits it. */
    private static final java.security.SecureRandom RNG =
            new java.security.SecureRandom();
    private static final String UID_ALPHA =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final String UID_ALNUM = UID_ALPHA + "0123456789";

    private static String generateDhis2Uid() {
        final StringBuilder sb = new StringBuilder(11);
        sb.append(UID_ALPHA.charAt(RNG.nextInt(UID_ALPHA.length())));
        for (int i = 0; i < 10; i++) {
            sb.append(UID_ALNUM.charAt(RNG.nextInt(UID_ALNUM.length())));
        }
        return sb.toString();
    }
}
