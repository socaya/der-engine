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
        // REL-S-003: constraint validation. Pull the relationship
        // type's from/to constraints from the mirror and verify the
        // operator-selected endpoint actually belongs to the
        // constrained program/stage/TET. Without this a client with
        // out-of-date metadata (or a tampered payload) could post a
        // relationship central would reject on drain — the
        // operator'd see it succeed locally and fail silently later.
        final Map<String, String> typeConstraints =
                lookupTypeConstraints(body.relationshipType());
        if (typeConstraints == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "RELATIONSHIP_TYPE_NOT_FOUND",
                    "message", "relationshipType "
                        + body.relationshipType() + " is not configured"));
        }
        final String fromMismatch = checkConstraint("from",
                fromType, body.fromEntityUid(),
                typeConstraints.get("from_kind"),
                typeConstraints.get("from_uid"));
        if (fromMismatch != null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "CONSTRAINT_MISMATCH", "message", fromMismatch));
        }
        final String toMismatch = checkConstraint("to",
                toType, body.toEntityUid(),
                typeConstraints.get("to_kind"),
                typeConstraints.get("to_uid"));
        if (toMismatch != null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "CONSTRAINT_MISMATCH", "message", toMismatch));
        }
        // REL-S-010: duplicate prevention. If a live (not soft-
        // deleted) row already exists with the same semantic
        // (type, from, to), reject with 409 Conflict + return the
        // existing row so the client can pick it up instead of
        // trying again. The V100 partial-unique index enforces
        // this at the DB layer too; this read-before-write is
        // just for operator-friendly messaging.
        final Optional<TrackerRelationship> existing =
                repo.findBySemantic(body.relationshipType(),
                        fromType, body.fromEntityUid(),
                        toType, body.toEntityUid());
        if (existing.isPresent()) {
            return ResponseEntity.status(409).body(Map.of(
                    "code", "RELATIONSHIP_DUPLICATE",
                    "message", "A relationship with this type and "
                        + "endpoints already exists on this record.",
                    "existing", toJson(existing.get())));
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
        // Flip sync_status to PENDING now that the drain has work
        // queued. If the enqueue above threw, we'd have left the
        // row at LOCAL — a safer state than claiming PENDING with
        // nothing in the queue.
        final Instant now = Instant.now(clock);
        repo.markSyncStatus(r.relationshipUid(),
                TrackerRelationship.SyncStatus.PENDING, now);
        return ResponseEntity.ok(toJson(repo.findById(
                r.relationshipUid()).orElse(r)));
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
                                                               @RequestParam("entityUid") final String entityUid,
                                                               @RequestParam(value = "limit",
                                                                   required = false,
                                                                   defaultValue = "100") final int limit,
                                                               @RequestParam(value = "cursor",
                                                                   required = false)
                                                               final String cursor) {
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
        // REL-S-013: cursor pagination. Cursor is an ISO-8601
        // instant string (the previous page's last row's
        // createdAt). Invalid cursor → 400 rather than silently
        // returning the newest page, so a corrupt cursor doesn't
        // make the client think it reached the end.
        Instant cursorBefore = null;
        if (cursor != null && !cursor.isBlank()) {
            try {
                cursorBefore = Instant.parse(cursor);
            } catch (Exception ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "CURSOR_INVALID",
                        "message", "cursor must be an ISO-8601 instant"));
            }
        }
        final int cappedLimit = Math.max(1, Math.min(limit, 500));
        final List<TrackerRelationship> rows =
                repo.findForEntity(type, entityUid, cappedLimit, cursorBefore);
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
        /* TEI displayName enrichment: so cards / table rows show a
         * real patient name ("John Doe · ART#1234") instead of the
         * raw UID. Collect every TEI uid that appears on either
         * side (plus the teiUid carried on each enrolment detail),
         * then resolve display names in one batch. */
        final Set<String> teiUids = new HashSet<>();
        for (final TrackerRelationship r : rows) {
            if (r.fromEntityType() == TrackerRelationship.EntityType.TRACKED_ENTITY) {
                teiUids.add(r.fromEntityUid());
            }
            if (r.toEntityType() == TrackerRelationship.EntityType.TRACKED_ENTITY) {
                teiUids.add(r.toEntityUid());
            }
        }
        for (final Enrollment e : enrolByUid.values()) {
            teiUids.add(e.teiUid());
        }
        final Map<String, String> teiDisplayByUid =
                lookupTeiDisplayNames(teiUids);
        final List<Map<String, Object>> payload = rows.stream()
                .map(r -> toJson(r, enrolByUid, eventByUid,
                        programNameByUid, stageNameByUid,
                        teiDisplayByUid)).toList();
        // nextCursor: the oldest row's createdAt in this page,
        // iff the page was full (i.e. there might be more). Null
        // signals "end of list" to the client.
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("relationships", payload);
        out.put("limit", cappedLimit);
        if (rows.size() == cappedLimit) {
            out.put("nextCursor",
                    rows.get(rows.size() - 1).createdAt().toString());
        } else {
            out.put("nextCursor", null);
        }
        return ResponseEntity.ok(out);
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

    /** Resolve human-friendly TEI display names for each UID in the
     *  input set — single SQL round-trip joining tracked_entity +
     *  metadata_tracked_entity_attribute. For each TEI, picks up to
     *  three text-ish attributes (ordered by the TEA's payload
     *  sortOrder) that have non-empty values, and joins their
     *  values with spaces. Falls back to the raw UID when no
     *  displayable attributes are set — the UI treats an unresolved
     *  name as "Tracked entity · <uid>", same as before. */
    private Map<String, String> lookupTeiDisplayNames(
            final Set<String> uids) {
        if (uids.isEmpty()) {
            return Map.of();
        }
        // jsonb_exists() instead of the ? operator because
        // NamedParameterJdbcTemplate mistakes the ? for a
        // positional placeholder and refuses to run the query.
        final String sql = "WITH t AS ("
                + "  SELECT te.tei_uid, mtea.dhis2_uid AS attr_uid, "
                + "         te.attributes->>mtea.dhis2_uid AS value, "
                + "         COALESCE((mtea.payload->>'sortOrder')"
                + "                  ::int, 9999) AS sort_order "
                + "  FROM der.tracked_entity te "
                + "  JOIN der.metadata_tracked_entity_attribute mtea "
                + "    ON jsonb_exists(te.attributes, mtea.dhis2_uid) "
                + "  WHERE te.tei_uid IN (:uids) "
                + "    AND mtea.value_type IN ('TEXT','LONG_TEXT',"
                + "        'LETTER','PHONE_NUMBER','EMAIL') "
                + "    AND te.attributes->>mtea.dhis2_uid IS NOT NULL "
                + "    AND te.attributes->>mtea.dhis2_uid <> '') "
                + "SELECT tei_uid, value FROM ("
                + "  SELECT tei_uid, value, "
                + "         ROW_NUMBER() OVER ("
                + "           PARTITION BY tei_uid "
                + "           ORDER BY sort_order, attr_uid) AS rn "
                + "  FROM t) s "
                + "WHERE rn <= 3 "
                + "ORDER BY tei_uid, rn";
        final Map<String, String> out = new HashMap<>();
        namedJdbc.query(sql,
                new MapSqlParameterSource("uids", uids),
                rs -> {
                    final String teiUid = rs.getString(1);
                    final String v = rs.getString(2);
                    if (v == null || v.isBlank()) {
                        return;
                    }
                    final String existing = out.get(teiUid);
                    out.put(teiUid, existing == null
                            ? v : existing + ' ' + v);
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

    /** Fetch the relationship type's constraint kinds + target UIDs
     *  from the metadata mirror. Returns a map with keys
     *  "from_kind", "from_uid", "to_kind", "to_uid" (nullable
     *  values) or null when the type doesn't exist in the mirror
     *  — the caller treats that as a RELATIONSHIP_TYPE_NOT_FOUND. */
    private Map<String, String> lookupTypeConstraints(final String typeUid) {
        try {
            return namedJdbc.queryForObject(
                    "SELECT from_constraint_kind AS from_kind, "
                        + "from_constraint_uid AS from_uid, "
                        + "to_constraint_kind AS to_kind, "
                        + "to_constraint_uid AS to_uid "
                        + "FROM der.metadata_relationship_type "
                        + "WHERE dhis2_uid = :uid",
                    new org.springframework.jdbc.core.namedparam
                            .MapSqlParameterSource("uid", typeUid),
                    (rs, n) -> {
                        final Map<String, String> m = new LinkedHashMap<>();
                        m.put("from_kind", rs.getString("from_kind"));
                        m.put("from_uid", rs.getString("from_uid"));
                        m.put("to_kind", rs.getString("to_kind"));
                        m.put("to_uid", rs.getString("to_uid"));
                        return m;
                    });
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            return null;
        }
    }

    /** Verify a side's endpoint satisfies the type's constraint.
     *  Returns null on pass; an operator-friendly error message on
     *  fail. Checks:
     *  - entity-type kind matches (TRACKED_ENTITY_INSTANCE =
     *    TRACKED_ENTITY, PROGRAM_INSTANCE = ENROLLMENT,
     *    PROGRAM_STAGE_INSTANCE = EVENT);
     *  - for TRACKED_ENTITY: the TEI's TET matches constraint UID
     *    (when the type pins one);
     *  - for ENROLLMENT: the enrolment's programUid matches
     *    constraint UID (when set);
     *  - for EVENT: the event's programStageUid matches constraint
     *    UID (when set).
     *  Null constraint kind = no constraint expressed in metadata
     *  (rare but valid), skip. */
    private String checkConstraint(final String side,
                                     final TrackerRelationship.EntityType entityType,
                                     final String entityUid,
                                     final String constraintKind,
                                     final String constraintUid) {
        if (constraintKind == null) {
            return null;
        }
        final String expectedEdgeKind = switch (constraintKind) {
            case "TRACKED_ENTITY_INSTANCE" -> "TRACKED_ENTITY";
            case "PROGRAM_INSTANCE" -> "ENROLLMENT";
            case "PROGRAM_STAGE_INSTANCE" -> "EVENT";
            default -> null;
        };
        if (expectedEdgeKind == null
                || !expectedEdgeKind.equals(entityType.name())) {
            return side + " must be a " + expectedEdgeKind
                    + " (type's " + side + "Constraint is "
                    + constraintKind + ")";
        }
        if (constraintUid == null) {
            return null;
        }
        if (entityType == TrackerRelationship.EntityType.TRACKED_ENTITY) {
            final String actualTet = teis.findById(entityUid)
                    .map(t -> t.trackedEntityType()).orElse(null);
            if (actualTet == null) {
                return side + " " + entityType + " " + entityUid
                        + " not found";
            }
            if (!constraintUid.equals(actualTet)) {
                return side + " tracked entity's TET (" + actualTet
                        + ") does not match type constraint ("
                        + constraintUid + ")";
            }
            return null;
        }
        if (entityType == TrackerRelationship.EntityType.ENROLLMENT) {
            final String actualProgram = enrollments.findById(entityUid)
                    .map(e -> e.programUid()).orElse(null);
            if (actualProgram == null) {
                return side + " enrolment " + entityUid + " not found";
            }
            if (!constraintUid.equals(actualProgram)) {
                return side + " enrolment's program (" + actualProgram
                        + ") does not match type constraint ("
                        + constraintUid + ")";
            }
            return null;
        }
        // EVENT
        final String actualStage = events.findById(entityUid)
                .map(e -> e.programStageUid()).orElse(null);
        if (actualStage == null) {
            return side + " event " + entityUid + " not found";
        }
        if (!constraintUid.equals(actualStage)) {
            return side + " event's stage (" + actualStage
                    + ") does not match type constraint ("
                    + constraintUid + ")";
        }
        return null;
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
        out.put("syncStatus", r.syncStatus().name());
        out.put("relClass", r.relClass().name());
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
            final Map<String, String> stageNameByUid,
            final Map<String, String> teiDisplayByUid) {
        final Map<String, Object> out = toJson(r);
        final Object fromDetail = endpointDetail(r.fromEntityType(),
                r.fromEntityUid(), enrolByUid, eventByUid,
                programNameByUid, stageNameByUid, teiDisplayByUid);
        if (fromDetail != null) {
            out.put("fromDetail", fromDetail);
        }
        final Object toDetail = endpointDetail(r.toEntityType(),
                r.toEntityUid(), enrolByUid, eventByUid,
                programNameByUid, stageNameByUid, teiDisplayByUid);
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
            final Map<String, String> stageNameByUid,
            final Map<String, String> teiDisplayByUid) {
        if (t == TrackerRelationship.EntityType.TRACKED_ENTITY) {
            final String name = teiDisplayByUid.get(uid);
            if (name == null) {
                return null;
            }
            final Map<String, Object> d = new LinkedHashMap<>();
            d.put("teiUid", uid);
            d.put("displayName", name);
            return d;
        }
        if (t == TrackerRelationship.EntityType.ENROLLMENT) {
            final Enrollment e = enrolByUid.get(uid);
            if (e == null) {
                return null;
            }
            final Map<String, Object> d = new LinkedHashMap<>();
            d.put("teiUid", e.teiUid());
            final String teiName = teiDisplayByUid.get(e.teiUid());
            if (teiName != null) {
                d.put("teiDisplayName", teiName);
            }
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
