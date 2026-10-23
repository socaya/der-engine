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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackerEventRepository;
import ug.ac.mak.der.workflows.tracker.TrackerRelationship;
import ug.ac.mak.der.workflows.tracker.TrackerRelationshipRepository;

/**
 * FR-08-06: typed relationships with referential integrity. Both
 * endpoints of a relationship must exist before it can be created.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/tracker/relationships",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class TrackerRelationshipController {

    private final TrackerRelationshipRepository repo;
    private final TrackedEntityRepository teis;
    private final EnrollmentRepository enrollments;
    private final TrackerEventRepository events;
    private final Clock clock;

    public TrackerRelationshipController(final TrackerRelationshipRepository repo,
                                           final TrackedEntityRepository teis,
                                           final EnrollmentRepository enrollments,
                                           final TrackerEventRepository events,
                                           final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.teis = Objects.requireNonNull(teis, "teis");
        this.enrollments = Objects.requireNonNull(enrollments, "enrollments");
        this.events = Objects.requireNonNull(events, "events");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> create(final Authentication authentication,
                                                        @RequestBody final CreateRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.relationshipUid() == null
                || body.relationshipType() == null
                || body.fromEntityType() == null || body.fromEntityUid() == null
                || body.toEntityType() == null || body.toEntityUid() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "RELATIONSHIP_INVALID",
                    "message", "uid, type, from/toEntityType, from/toEntityUid required"));
        }
        final TrackerRelationship.EntityType fromType;
        final TrackerRelationship.EntityType toType;
        try {
            fromType = TrackerRelationship.EntityType.valueOf(body.fromEntityType());
            toType = TrackerRelationship.EntityType.valueOf(body.toEntityType());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "RELATIONSHIP_TYPE_INVALID",
                    "message", "entityType must be TRACKED_ENTITY, ENROLLMENT or EVENT"));
        }
        if (!entityExists(fromType, body.fromEntityUid())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "FROM_NOT_FOUND",
                    "message", "from " + fromType + " " + body.fromEntityUid() + " not found"));
        }
        if (!entityExists(toType, body.toEntityUid())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "TO_NOT_FOUND",
                    "message", "to " + toType + " " + body.toEntityUid() + " not found"));
        }
        final TrackerRelationship r;
        try {
            r = new TrackerRelationship(body.relationshipUid(), body.relationshipType(),
                    fromType, body.fromEntityUid(), toType, body.toEntityUid(),
                    Boolean.TRUE.equals(body.bidirectional()),
                    principal.userId(), Instant.now(clock));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "RELATIONSHIP_INVALID", "message", ex.getMessage()));
        }
        repo.upsert(r);
        return ResponseEntity.ok(toJson(r));
    }

    @GetMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> get(final Authentication authentication,
                                                    @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return repo.findById(uid)
                .<ResponseEntity<Map<String, Object>>>map(r -> ResponseEntity.ok(toJson(r)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listForEntity(final Authentication authentication,
                                                               @RequestParam("entityType") final String entityType,
                                                               @RequestParam("entityUid") final String entityUid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final TrackerRelationship.EntityType type;
        try {
            type = TrackerRelationship.EntityType.valueOf(entityType);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ENTITY_TYPE_INVALID",
                    "message", "entityType must be TRACKED_ENTITY, ENROLLMENT or EVENT"));
        }
        final List<TrackerRelationship> rows = repo.findForEntity(type, entityUid);
        return ResponseEntity.ok(Map.of("relationships",
                rows.stream().map(TrackerRelationshipController::toJson).toList()));
    }

    @DeleteMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> delete(final Authentication authentication,
                                                        @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final int n = repo.delete(uid);
        return n == 0 ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(Map.of("deleted", true));
    }

    private boolean entityExists(final TrackerRelationship.EntityType type, final String uid) {
        return switch (type) {
            case TRACKED_ENTITY -> teis.findById(uid).isPresent();
            case ENROLLMENT -> enrollments.findById(uid).isPresent();
            case EVENT -> events.findById(uid).isPresent();
        };
    }

    private static Map<String, Object> toJson(final TrackerRelationship r) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("relationshipUid", r.relationshipUid());
        out.put("relationshipType", r.relationshipType());
        out.put("fromEntityType", r.fromEntityType().name());
        out.put("fromEntityUid", r.fromEntityUid());
        out.put("toEntityType", r.toEntityType().name());
        out.put("toEntityUid", r.toEntityUid());
        out.put("bidirectional", r.bidirectional());
        out.put("createdBy", r.createdBy().toString());
        out.put("createdAt", r.createdAt().toString());
        return out;
    }

    public record CreateRequest(
            @JsonProperty("relationshipUid") String relationshipUid,
            @JsonProperty("relationshipType") String relationshipType,
            @JsonProperty("fromEntityType") String fromEntityType,
            @JsonProperty("fromEntityUid") String fromEntityUid,
            @JsonProperty("toEntityType") String toEntityType,
            @JsonProperty("toEntityUid") String toEntityUid,
            @JsonProperty("bidirectional") Boolean bidirectional) { }
}
