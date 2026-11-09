package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.tracker.Enrollment;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackerEvent;
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
    private final OperationJournalRepository journal;
    private final ObjectMapper json;
    private final Clock clock;
    /** Metadata-mirror lookup for program / programStage display
     *  names. Used by the list endpoint to enrich enrolment / event
     *  endpoints with human labels so the client can render
     *  "Enrolment · HIV Pro · 2026-11-08" instead of bare UIDs. */
    private final NamedParameterJdbcTemplate namedJdbc;

    public TrackerRelationshipController(final TrackerRelationshipRepository repo,
                                           final TrackedEntityRepository teis,
                                           final EnrollmentRepository enrollments,
                                           final TrackerEventRepository events,
                                           final OperationJournalRepository journal,
                                           final ObjectMapper json,
                                           final Clock clock,
                                           final NamedParameterJdbcTemplate namedJdbc) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.teis = Objects.requireNonNull(teis, "teis");
        this.enrollments = Objects.requireNonNull(enrollments, "enrollments");
        this.events = Objects.requireNonNull(events, "events");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.json = Objects.requireNonNull(json, "json");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.namedJdbc = Objects.requireNonNull(namedJdbc, "namedJdbc");
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
        /* Full-emulation sync (slice 2): enqueue a journal entry so
         * the drain POSTs this relationship to central DHIS2 on
         * connectivity. Entity type is RELATIONSHIP; entityRef is
         * the relationship UID the device just generated (central
         * accepts client UIDs on POST /api/relationships, so the
         * same UID flows through both sides). */
        enqueueJournal(r, OperationKind.CREATE, principal.userId());
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
        // Enrichment: batch-lookup enrolment + event details so the
        // client can render human-friendly endpoint labels without a
        // separate round-trip per row. N (relationships for one TEI)
        // is small, so a findById loop beats inventing a batch method
        // on the repos just for this.
        final Set<String> enrolUids = new HashSet<>();
        final Set<String> eventUids = new HashSet<>();
        for (final TrackerRelationship r : rows) {
            collectRefUid(r.fromEntityType(), r.fromEntityUid(),
                    enrolUids, eventUids);
            collectRefUid(r.toEntityType(), r.toEntityUid(),
                    enrolUids, eventUids);
        }
        final Map<String, Enrollment> enrolByUid = new HashMap<>();
        for (final String uid : enrolUids) {
            enrollments.findById(uid).ifPresent(
                    e -> enrolByUid.put(uid, e));
        }
        final Map<String, TrackerEvent> eventByUid = new HashMap<>();
        for (final String uid : eventUids) {
            events.findById(uid).ifPresent(ev -> eventByUid.put(uid, ev));
        }
        // Resolve program + stage display names from the metadata
        // mirror so the operator sees "HIV Pro" rather than a UID.
        final Set<String> programUids = new HashSet<>();
        final Set<String> stageUids = new HashSet<>();
        for (final Enrollment e : enrolByUid.values()) {
            programUids.add(e.programUid());
        }
        for (final TrackerEvent ev : eventByUid.values()) {
            programUids.add(ev.programUid());
            stageUids.add(ev.programStageUid());
        }
        final Map<String, String> programNameByUid =
                lookupDisplayNames("metadata_program", programUids);
        final Map<String, String> stageNameByUid =
                lookupDisplayNames("metadata_program_stage", stageUids);
        return ResponseEntity.ok(Map.of("relationships",
                rows.stream().map(r -> toJson(r,
                        enrolByUid, eventByUid,
                        programNameByUid, stageNameByUid)).toList()));
    }

    private static void collectRefUid(final TrackerRelationship.EntityType t,
                                        final String uid,
                                        final Set<String> enrolUids,
                                        final Set<String> eventUids) {
        if (t == TrackerRelationship.EntityType.ENROLLMENT) {
            enrolUids.add(uid);
        } else if (t == TrackerRelationship.EntityType.EVENT) {
            eventUids.add(uid);
        }
    }

    private Map<String, String> lookupDisplayNames(final String tableName,
                                                     final Set<String> uids) {
        if (uids.isEmpty()) {
            return Map.of();
        }
        // Table name is a server-controlled literal — one of
        // metadata_program / metadata_program_stage. Not user input.
        final String sql = "SELECT dhis2_uid, display_name FROM der."
                + tableName + " WHERE dhis2_uid IN (:uids)";
        final Map<String, String> out = new HashMap<>();
        namedJdbc.query(sql,
                new MapSqlParameterSource("uids", uids),
                rs -> {
                    out.put(rs.getString(1), rs.getString(2));
                });
        return out;
    }

    @DeleteMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> delete(final Authentication authentication,
                                                        @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<TrackerRelationship> existing = repo.findById(uid);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final TrackerRelationship r = existing.get();
        /* Full-emulation sync: soft-delete + journal entry. The
         * drain reads the soft-delete, POSTs DELETE /api/relation-
         * ships/{uid} to central, and only then purges the row. */
        repo.softDelete(uid, Instant.now(clock));
        enqueueJournal(r, OperationKind.DELETE, principal.userId());
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    private void enqueueJournal(final TrackerRelationship r,
                                  final OperationKind kind,
                                  final UUID submittedBy) {
        final ObjectNode payload = json.createObjectNode();
        payload.put("operation", kind.name());
        payload.put("relationshipUid", r.relationshipUid());
        payload.put("relationshipType", r.relationshipType());
        payload.put("fromEntityType", r.fromEntityType().name());
        payload.put("fromEntityUid", r.fromEntityUid());
        payload.put("toEntityType", r.toEntityType().name());
        payload.put("toEntityUid", r.toEntityUid());
        payload.put("bidirectional", r.bidirectional());
        final Instant now = Instant.now(clock);
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.RELATIONSHIP,
                r.relationshipUid(),
                payload,
                OperationJournalEntry.State.PENDING,
                0, null, submittedBy, now, now));
    }

    private enum OperationKind { CREATE, DELETE }

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

    /** Enriched row for the list endpoint — same base shape as
     *  {@link #toJson(TrackerRelationship)} but with nested
     *  display objects on either side when the endpoint is an
     *  enrolment or an event. Clients that only care about UIDs
     *  can ignore the extra fields; clients that want to render
     *  human labels have everything in one payload. */
    private static Map<String, Object> toJson(
            final TrackerRelationship r,
            final Map<String, Enrollment> enrolByUid,
            final Map<String, TrackerEvent> eventByUid,
            final Map<String, String> programNameByUid,
            final Map<String, String> stageNameByUid) {
        final Map<String, Object> out = toJson(r);
        final Object fromDetail = endpointDetail(r.fromEntityType(),
                r.fromEntityUid(), enrolByUid, eventByUid,
                programNameByUid, stageNameByUid);
        if (fromDetail != null) {
            out.put("fromDetail", fromDetail);
        }
        final Object toDetail = endpointDetail(r.toEntityType(),
                r.toEntityUid(), enrolByUid, eventByUid,
                programNameByUid, stageNameByUid);
        if (toDetail != null) {
            out.put("toDetail", toDetail);
        }
        return out;
    }

    private static Map<String, Object> endpointDetail(
            final TrackerRelationship.EntityType t, final String uid,
            final Map<String, Enrollment> enrolByUid,
            final Map<String, TrackerEvent> eventByUid,
            final Map<String, String> programNameByUid,
            final Map<String, String> stageNameByUid) {
        if (t == TrackerRelationship.EntityType.ENROLLMENT) {
            final Enrollment e = enrolByUid.get(uid);
            if (e == null) {
                return null;
            }
            final Map<String, Object> d = new LinkedHashMap<>();
            d.put("teiUid", e.teiUid());
            d.put("programUid", e.programUid());
            final String pname = programNameByUid.get(e.programUid());
            if (pname != null) {
                d.put("programName", pname);
            }
            d.put("enrollmentDate", e.enrollmentDate().toString());
            d.put("status", e.status().name());
            return d;
        }
        if (t == TrackerRelationship.EntityType.EVENT) {
            final TrackerEvent ev = eventByUid.get(uid);
            if (ev == null) {
                return null;
            }
            final Map<String, Object> d = new LinkedHashMap<>();
            d.put("enrollmentUid", ev.enrollmentUid());
            d.put("programUid", ev.programUid());
            d.put("programStageUid", ev.programStageUid());
            final String pname = programNameByUid.get(ev.programUid());
            if (pname != null) {
                d.put("programName", pname);
            }
            final String sname = stageNameByUid.get(ev.programStageUid());
            if (sname != null) {
                d.put("programStageName", sname);
            }
            d.put("occurredDate", ev.occurredDate().toString());
            d.put("status", ev.status().name());
            return d;
        }
        return null;
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
