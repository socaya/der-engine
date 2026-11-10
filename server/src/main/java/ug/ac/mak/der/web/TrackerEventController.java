package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

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
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.attribution.CapturedByResolver;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.SystemWorkflowService;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackerEvent;
import ug.ac.mak.der.workflows.tracker.TrackerEventRepository;
import ug.ac.mak.der.workflows.tracker.TrackerService;

/** FR-08-10: tracker-stage event lifecycle. */
@RestController
@RequestMapping(path = "/edge-api/v1/tracker/events",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class TrackerEventController {

    private final TrackerEventRepository repo;
    private final EnrollmentRepository enrollments;
    private final CapturedByResolver captorResolver;
    private final TrackerService trackerService;
    private final SystemWorkflowService systemWorkflows;
    private final OperationJournalRepository journal;
    private final ObjectMapper jsonMapper;
    private final Clock clock;

    public TrackerEventController(final TrackerEventRepository repo,
                                    final EnrollmentRepository enrollments,
                                    final CapturedByResolver captorResolver,
                                    final TrackerService trackerService,
                                    final SystemWorkflowService systemWorkflows,
                                    final OperationJournalRepository journal,
                                    final ObjectMapper jsonMapper,
                                    final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.enrollments = Objects.requireNonNull(enrollments, "enrollments");
        this.captorResolver = Objects.requireNonNull(captorResolver, "captorResolver");
        this.trackerService = Objects.requireNonNull(trackerService, "trackerService");
        this.systemWorkflows = Objects.requireNonNull(systemWorkflows, "systemWorkflows");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upsert(final Authentication authentication,
                                                        @RequestBody final UpsertRequest body,
                                                        final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.eventUid() == null || body.programUid() == null
                || body.programStageUid() == null || body.orgUnitUid() == null
                || body.occurredDate() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "EVENT_INVALID",
                    "message", "eventUid, programUid, programStageUid, orgUnitUid, occurredDate are required"));
        }
        if (body.enrollmentUid() != null
                && enrollments.findById(body.enrollmentUid()).isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ENROLLMENT_NOT_FOUND",
                    "message", "enrollment " + body.enrollmentUid() + " not found"));
        }
        final TrackerEvent.Status status;
        try {
            status = body.status() == null ? TrackerEvent.Status.ACTIVE
                    : TrackerEvent.Status.valueOf(body.status());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "EVENT_STATUS_INVALID",
                    "message", "status must be one of ACTIVE/COMPLETED/VISITED/SCHEDULED/OVERDUE/SKIPPED"));
        }
        final Instant now = Instant.now(clock);
        final String storedBy = captorResolver.storedByFor(principal.userId()).orElse(null);
        // §2.3.89 R-C/3 — tracker stage events auto-wrap into the
        // same TRACKER_CAPTURE scope as their parent enrolment, so
        // the whole workflow (TEI → enrol → events) rolls up under a
        // single run per (program, orgUnit, submitter).
        final UUID runId = systemWorkflows.ensureTrackerCaptureRun(
                body.programUid(), body.orgUnitUid(), principal.userId());
        final TrackerEvent e;
        try {
            e = new TrackerEvent(body.eventUid(), body.enrollmentUid(),
                    body.programUid(), body.programStageUid(), body.orgUnitUid(),
                    status, body.occurredDate(),
                    body.dataValues() == null ? Map.of() : body.dataValues(),
                    storedBy, principal.userId(), now, now, 1, runId);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "EVENT_INVALID", "message", ex.getMessage()));
        }
        // §2.3.96 R-D/tracker-svc — service handles upsert + outbox
        // + audit in one @Transactional unit.
        trackerService.upsertEvent(e, principal.userId(),
                http == null ? null : http.getRemoteAddr(),
                http == null ? null : http.getHeader(HttpHeaders.USER_AGENT));
        return ResponseEntity.ok(toJson(e));
    }

    @GetMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> get(final Authentication authentication,
                                                    @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return repo.findById(uid)
                .<ResponseEntity<Map<String, Object>>>map(e -> ResponseEntity.ok(toJson(e)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/by-enrollment/{enrollmentUid}")
    public ResponseEntity<Map<String, Object>> byEnrollment(
            final Authentication authentication,
            @PathVariable("enrollmentUid") final String enrollmentUid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<TrackerEvent> rows = repo.findByEnrollment(enrollmentUid);
        return ResponseEntity.ok(Map.of("events",
                rows.stream().map(TrackerEventController::toJson).toList()));
    }

    /** SM-1b — delete the event on the edge AND enqueue a
     *  PROGRAM_STAGE_EVENT tombstone so the next drain POSTs the
     *  matching DELETE to central (/api/tracker?importStrategy=
     *  DELETE). Mirrors the TEI + Enrolment + Relationship patterns.
     *  Before this fix the edge hard-deleted the row and central
     *  never learned about the delete — orphaned events on central. */
    @DeleteMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> delete(final Authentication authentication,
                                                        @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final TrackerEvent existing = repo.findById(uid).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        repo.delete(uid);
        enqueueDeleteTombstone(existing, principal.userId());
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    private void enqueueDeleteTombstone(final TrackerEvent e,
                                          final UUID actor) {
        final ObjectNode payload = jsonMapper.createObjectNode();
        payload.put("eventUid", e.eventUid());
        payload.put("enrollmentUid", e.enrollmentUid());
        payload.put("program", e.programUid());
        payload.put("programStage", e.programStageUid());
        payload.put("orgUnit", e.orgUnitUid());
        payload.put("occurredDate", e.occurredDate().toString());
        payload.put("operation", "DELETE");
        final Instant now = Instant.now(clock);
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT,
                e.eventUid(),
                payload,
                OperationJournalEntry.State.PENDING,
                0, null, actor, now, now, null, e.workflowRunId()));
    }

    private static Map<String, Object> toJson(final TrackerEvent e) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("eventUid", e.eventUid());
        out.put("enrollmentUid", e.enrollmentUid());
        out.put("programUid", e.programUid());
        out.put("programStageUid", e.programStageUid());
        out.put("orgUnitUid", e.orgUnitUid());
        out.put("status", e.status().name());
        out.put("occurredDate", e.occurredDate().toString());
        out.put("dataValues", e.dataValues());
        out.put("storedBy", e.storedByDhis2Uid());
        out.put("createdBy", e.createdBy().toString());
        out.put("createdAt", e.createdAt().toString());
        out.put("updatedAt", e.updatedAt().toString());
        out.put("version", e.version());
        return out;
    }

    public record UpsertRequest(
            @JsonProperty("eventUid") String eventUid,
            @JsonProperty("enrollmentUid") String enrollmentUid,
            @JsonProperty("programUid") String programUid,
            @JsonProperty("programStageUid") String programStageUid,
            @JsonProperty("orgUnitUid") String orgUnitUid,
            @JsonProperty("status") String status,
            @JsonProperty("occurredDate") LocalDate occurredDate,
            @JsonProperty("dataValues") Map<String, Object> dataValues) { }
}
