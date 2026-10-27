package ug.ac.mak.der.web;

import java.util.List;
import java.util.Objects;

import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.scheduler.ScheduledJobRepository;
import ug.ac.mak.der.scheduler.ScheduledJobRun;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** ADR-0008 admin surface for the scheduler. */
@RestController
@RequestMapping(path = "/edge-api/v1/sync/jobs", produces = MediaType.APPLICATION_JSON_VALUE)
public class SyncJobsController {

    private final ScheduledJobRepository runs;
    private final Scheduler scheduler;

    public SyncJobsController(final ScheduledJobRepository runs, final Scheduler scheduler) {
        this.runs = Objects.requireNonNull(runs, "runs");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
    }

    @GetMapping
    public ResponseEntity<List<ScheduledJobRun>> list(final Authentication authentication,
                                                       @RequestParam(name = "limit", defaultValue = "50")
                                                       final int limit,
                                                       @RequestParam(name = "jobName", required = false)
                                                       final String jobName) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (jobName != null && !jobName.isBlank()) {
            return ResponseEntity.ok(runs.findRecentForJob(jobName, limit));
        }
        return ResponseEntity.ok(runs.findRecent(limit));
    }

    @PostMapping("/{name}/trigger")
    public ResponseEntity<Object> trigger(final Authentication authentication,
                                           @PathVariable("name") final String name)
            throws SchedulerException {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        final JobKey key = JobKey.jobKey(name);
        if (!scheduler.checkExists(key)) {
            return ResponseEntity.status(404).body(java.util.Map.of("error", "unknown job: " + name));
        }
        scheduler.triggerJob(key);
        return ResponseEntity.accepted().body(java.util.Map.of("triggered", name));
    }
}
