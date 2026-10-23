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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.attribution.CapturedByResolver;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.tracker.Enrollment;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;

/**
 * FR-08-06..12 tracker enrollment lifecycle. Enforces FK integrity
 * against {@link TrackedEntityRepository} and persists captor
 * attribution via {@link CapturedByResolver}.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/tracker/enrollments",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class EnrollmentController {

    private final EnrollmentRepository repo;
    private final TrackedEntityRepository teiRepo;
    private final CapturedByResolver captorResolver;
    private final Clock clock;

    public EnrollmentController(final EnrollmentRepository repo,
                                  final TrackedEntityRepository teiRepo,
                                  final CapturedByResolver captorResolver,
                                  final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.teiRepo = Objects.requireNonNull(teiRepo, "teiRepo");
        this.captorResolver = Objects.requireNonNull(captorResolver, "captorResolver");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upsert(final Authentication authentication,
                                                        @RequestBody final UpsertRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.enrollmentUid() == null || body.teiUid() == null
                || body.programUid() == null || body.orgUnitUid() == null
                || body.enrollmentDate() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ENROLLMENT_INVALID",
                    "message", "enrollmentUid, teiUid, programUid, orgUnitUid, enrollmentDate are required"));
        }
        if (teiRepo.findById(body.teiUid()).isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "TEI_NOT_FOUND",
                    "message", "parent tracked entity " + body.teiUid() + " not found"));
        }
        final Enrollment.Status status;
        try {
            status = body.status() == null ? Enrollment.Status.ACTIVE
                    : Enrollment.Status.valueOf(body.status());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ENROLLMENT_STATUS_INVALID",
                    "message", "status must be ACTIVE, COMPLETED or CANCELLED"));
        }
        final Instant now = Instant.now(clock);
        final String storedBy = captorResolver.storedByFor(principal.userId()).orElse(null);
        final Enrollment e;
        try {
            e = new Enrollment(body.enrollmentUid(), body.teiUid(),
                    body.programUid(), body.orgUnitUid(), status,
                    body.enrollmentDate(), body.incidentDate(), storedBy,
                    principal.userId(), now, now, 1);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ENROLLMENT_INVALID", "message", ex.getMessage()));
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

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(final Authentication authentication,
                                                      @RequestParam(value = "teiUid", required = false) final String teiUid,
                                                      @RequestParam(value = "programUid", required = false) final String programUid,
                                                      @RequestParam(value = "limit", defaultValue = "50") final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<Enrollment> rows;
        if (teiUid != null) {
            rows = repo.findByTei(teiUid);
        } else if (programUid != null) {
            rows = repo.findByProgram(programUid, limit);
        } else {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "FILTER_REQUIRED",
                    "message", "teiUid or programUid filter required"));
        }
        return ResponseEntity.ok(Map.of("enrollments",
                rows.stream().map(EnrollmentController::toJson).toList()));
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

    private static Map<String, Object> toJson(final Enrollment e) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("enrollmentUid", e.enrollmentUid());
        out.put("teiUid", e.teiUid());
        out.put("programUid", e.programUid());
        out.put("orgUnitUid", e.orgUnitUid());
        out.put("status", e.status().name());
        out.put("enrollmentDate", e.enrollmentDate().toString());
        out.put("incidentDate", e.incidentDate() == null ? null : e.incidentDate().toString());
        out.put("storedBy", e.storedByDhis2Uid());
        out.put("createdBy", e.createdBy().toString());
        out.put("createdAt", e.createdAt().toString());
        out.put("updatedAt", e.updatedAt().toString());
        out.put("version", e.version());
        return out;
    }

    public record UpsertRequest(
            @JsonProperty("enrollmentUid") String enrollmentUid,
            @JsonProperty("teiUid") String teiUid,
            @JsonProperty("programUid") String programUid,
            @JsonProperty("orgUnitUid") String orgUnitUid,
            @JsonProperty("status") String status,
            @JsonProperty("enrollmentDate") LocalDate enrollmentDate,
            @JsonProperty("incidentDate") LocalDate incidentDate) { }
}
