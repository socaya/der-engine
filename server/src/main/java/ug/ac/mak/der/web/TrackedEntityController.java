package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity;

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
    private final Clock clock;

    public TrackedEntityController(final TrackedEntityRepository repo, final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** FR-08-01: create or update a TEI with required attributes + stable UID. */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upsert(final Authentication authentication,
                                                        @RequestBody final TeiRequest body) {
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
                ? java.util.UUID.randomUUID().toString()
                : body.teiUid().trim();
        final Instant now = Instant.now(clock);
        final TrackedEntity stored = repo.upsert(new TrackedEntity(
                teiUid, body.trackedEntityType(), body.orgUnit(),
                body.attributes() == null ? Map.of() : body.attributes(),
                principal.userId(), now, now, 1));
        return ResponseEntity.ok(toJson(stored));
    }

    /** FR-08-02: search by indexed authorised fields. */
    @GetMapping
    public ResponseEntity<Map<String, Object>> search(
            @RequestParam(required = false) final String trackedEntityType,
            @RequestParam(required = false) final String orgUnit,
            @RequestParam(required = false) final String attributeId,
            @RequestParam(required = false) final String attributeValue,
            @RequestParam(defaultValue = "50") final int limit) {
        final Map<String, String> filter = attributeId == null || attributeValue == null
                ? Map.of() : Map.of(attributeId, attributeValue);
        final List<TrackedEntity> hits = repo.search(trackedEntityType, orgUnit, filter, limit);
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
}
