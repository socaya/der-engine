package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
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
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.attribution.CapturedByResolver;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackerEvent;
import ug.ac.mak.der.workflows.tracker.TrackerEventRepository;

/** FR-08-10: tracker-stage event lifecycle. */
@RestController
@RequestMapping(path = "/edge-api/v1/tracker/events",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class TrackerEventController {

    private final TrackerEventRepository repo;
    private final EnrollmentRepository enrollments;
    private final CapturedByResolver captorResolver;
    private final Clock clock;

    public TrackerEventController(final TrackerEventRepository repo,
                                    final EnrollmentRepository enrollments,
                                    final CapturedByResolver captorResolver,
                                    final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.enrollments = Objects.requireNonNull(enrollments, "enrollments");
        this.captorResolver = Objects.requireNonNull(captorResolver, "captorResolver");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upsert(final Authentication authentication,
                                                        @RequestBody final UpsertRequest body) {
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
        final TrackerEvent e;
        try {
            e = new TrackerEvent(body.eventUid(), body.enrollmentUid(),
                    body.programUid(), body.programStageUid(), body.orgUnitUid(),
                    status, body.occurredDate(),
                    body.dataValues() == null ? Map.of() : body.dataValues(),
                    storedBy, principal.userId(), now, now, 1);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "EVENT_INVALID", "message", ex.getMessage()));
        }
        repo.upsert(e);
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
