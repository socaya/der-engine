package ug.ac.mak.der.dhis2emulator;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * DER-APPS-DHIS2-001 FR-EMU-004 — poll endpoints for
 * {@code POST /api/tracker?async=true}.
 *
 * <p>Mirrors DHIS2's three-step shape:
 * <ul>
 *   <li>{@code GET /api/tracker/jobs/{id}} — array of progress
 *       notifications. DER emits one {@code RUNNING} and one terminal
 *       entry.</li>
 *   <li>{@code GET /api/tracker/jobs/{id}/report} — the persisted
 *       ImportSummary once the job completes.</li>
 * </ul>
 */
@RestController
@RequestMapping(path = "/api/tracker/jobs",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class TrackerJobsController {

    private final TrackerJobRepository repo;

    public TrackerJobsController(final TrackerJobRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping(path = "/{jobId}")
    public ResponseEntity<List<Map<String, Object>>> notifications(
            @PathVariable("jobId") final String jobIdString) {
        final Optional<TrackerJobRepository.Row> row = parseAndLoad(jobIdString);
        if (row.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final TrackerJobRepository.Row r = row.get();
        final List<Map<String, Object>> notifications = new java.util.ArrayList<>();
        notifications.add(notification(r.jobId(), "INFO",
                r.createdAt().toString(), false, "Tracker import started"));
        if ("COMPLETED".equals(r.status())) {
            notifications.add(notification(r.jobId(), "INFO",
                    r.completedAt() == null ? r.createdAt().toString()
                            : r.completedAt().toString(),
                    true, "Tracker import complete"));
        } else if ("FAILED".equals(r.status())) {
            notifications.add(notification(r.jobId(), "ERROR",
                    r.completedAt() == null ? r.createdAt().toString()
                            : r.completedAt().toString(),
                    true, "Tracker import failed: "
                            + (r.errorMessage() == null ? "" : r.errorMessage())));
        }
        return ResponseEntity.ok(notifications);
    }

    @GetMapping(path = "/{jobId}/report")
    public ResponseEntity<Map<String, Object>> report(
            @PathVariable("jobId") final String jobIdString) {
        final Optional<TrackerJobRepository.Row> row = parseAndLoad(jobIdString);
        if (row.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(row.get().summary());
    }

    private Optional<TrackerJobRepository.Row> parseAndLoad(final String id) {
        final UUID uuid;
        try {
            uuid = UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
        return repo.findById(uuid);
    }

    private static Map<String, Object> notification(final UUID jobId,
                                                      final String level,
                                                      final String time,
                                                      final boolean completed,
                                                      final String message) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("uid", UUID.randomUUID().toString());
        m.put("level", level);
        m.put("category", "TRACKER_IMPORT_JOB");
        m.put("time", time);
        m.put("message", message);
        m.put("completed", completed);
        m.put("id", jobId.toString());
        return m;
    }
}
