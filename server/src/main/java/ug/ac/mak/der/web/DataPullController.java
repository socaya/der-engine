package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
import ug.ac.mak.der.scheduler.ScheduledJobRepository;
import ug.ac.mak.der.scheduler.ScheduledJobRun;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.pull.DataPullCursor;
import ug.ac.mak.der.workflows.pull.DataPullCursorRepository;
import ug.ac.mak.der.workflows.pull.DataPullService;

/**
 * Phase 09.5 — read-only surface over the ADR-0034 pull cursors.
 *
 * <p>The admin UI reads this on the Data overview + per-stream
 * screens to render the "Last pulled {ago}" chip and the per-cursor
 * failure counter so operators can see when the puller is stuck.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/data/pull",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class DataPullController {

    private static final String PULL_JOB = "DATA_PULL";

    private final DataPullCursorRepository cursors;
    private final DataPullService pulls;
    private final ScheduledJobRepository runs;
    private final OrgUnitBindingService binding;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper;

    public DataPullController(final DataPullCursorRepository cursors,
                                final DataPullService pulls,
                                final ScheduledJobRepository runs,
                                final OrgUnitBindingService binding,
                                final com.fasterxml.jackson.databind.ObjectMapper mapper) {
        this.cursors = Objects.requireNonNull(cursors, "cursors");
        this.pulls = Objects.requireNonNull(pulls, "pulls");
        this.runs = Objects.requireNonNull(runs, "runs");
        this.binding = Objects.requireNonNull(binding, "binding");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @GetMapping("/cursors")
    public ResponseEntity<Map<String, Object>> listCursors(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<Map<String, Object>> rows = cursors.findAll().stream()
                .map(DataPullController::toJson).toList();
        return ResponseEntity.ok(Map.of("cursors", rows));
    }

    /**
     * Phase 13.2 — manual pull trigger. Fires the puller synchronously
     * against the currently-bound org unit and writes a
     * scheduled_job_run row the admin UI can poll.
     *
     * <p>Returns 202 Accepted with the job run id so the UI can poll
     * {@link #getPullRun}. Returns 409 if the edge isn't bound to an
     * org unit yet (fresh install) — nothing to pull against.</p>
     */
    @PostMapping("/trigger")
    public ResponseEntity<Map<String, Object>> trigger(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final EdgeOrgUnitBinding bind = binding.current();
        if (bind == null || !bind.isBound()) {
            return ResponseEntity.status(409).body(Map.of(
                    "code", "DATA_PULL_NO_BINDING",
                    "message", "no org-unit binding; nothing to pull"));
        }
        final long t0 = System.nanoTime();
        final Long runId = runs.insertStart(PULL_JOB,
                "MANUAL:" + principal.user().username());
        try {
            final DataPullService.PullOutcome out = pulls.pullAll(bind.orgUnitId());
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            final Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("orgUnitUid", out.orgUnitUid());
            detail.put("aggregatePulled", out.aggregatePulled());
            detail.put("eventsPulled", out.eventsPulled());
            detail.put("trackerPulled", out.trackerPulled());
            detail.put("conflictsRaised", out.conflictsRaised());
            if (out.note() != null) {
                detail.put("note", out.note());
            }
            runs.markSuccess(runId, duration, writeJson(detail));
            return ResponseEntity.accepted().body(Map.of(
                    "runId", runId,
                    "status", "COMPLETED",
                    "orgUnitUid", bind.orgUnitId()));
        } catch (Exception ex) {
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            runs.markFailure(runId, duration, writeJson(Map.of(
                    "error", ex.getClass().getSimpleName(),
                    "message", String.valueOf(ex.getMessage()))));
            return ResponseEntity.status(500).body(Map.of(
                    "runId", runId,
                    "status", "FAILED",
                    "message", String.valueOf(ex.getMessage())));
        }
    }

    /**
     * Phase 13.2 — single pull-run detail. Returns the full job
     * run row keyed on {@code runId}; 404 when the run id isn't a
     * data-pull row (prevents the admin UI accidentally polling a
     * metadata-sync job id). The admin UI "Pull from Central"
     * button polls this every 2s until {@code status} is terminal.
     */
    @GetMapping("/runs/{runId}")
    public ResponseEntity<Map<String, Object>> getPullRun(final Authentication authentication,
                                                             @PathVariable("runId") final long runId) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final ScheduledJobRun row = runs.findById(runId);
        if (row == null || !PULL_JOB.equals(row.jobName())) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(runToJson(row));
    }

    /**
     * Phase 13.2 — recent pull-run history. Default 20; max 100.
     * The admin UI Data Overview uses this for the "last 10 pulls"
     * strip + manual-pull button's "last result" affordance.
     */
    @GetMapping("/runs")
    public ResponseEntity<Map<String, Object>> listPullRuns(final Authentication authentication,
                                                              @org.springframework.web.bind.annotation.RequestParam(
                                                                      name = "limit", defaultValue = "20")
                                                              final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final int capped = Math.max(1, Math.min(100, limit));
        final List<Map<String, Object>> rows = runs.findRecentForJob(PULL_JOB, capped).stream()
                .map(DataPullController::runToJson).toList();
        return ResponseEntity.ok(Map.of("runs", rows));
    }

    private String writeJson(final Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (Exception ex) {
            return "{}";
        }
    }

    private static Map<String, Object> runToJson(final ScheduledJobRun r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("runId", r.runId());
        m.put("jobName", r.jobName());
        m.put("status", r.outcome() == null ? "RUNNING" : r.outcome());
        m.put("startedAt", r.startedAt() == null ? null : r.startedAt().toString());
        m.put("finishedAt", r.finishedAt() == null ? null : r.finishedAt().toString());
        m.put("durationMs", r.durationMs());
        m.put("triggeredBy", r.triggeredBy());
        m.put("detail", r.detail());
        return m;
    }

    private static Map<String, Object> toJson(final DataPullCursor c) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("entityType", c.entityType().name());
        m.put("orgUnitUid", c.orgUnitUid());
        m.put("lastPulledAt", c.lastPulledAt() == null ? null : c.lastPulledAt().toString());
        m.put("lastCursor", c.lastCursor());
        m.put("consecutiveFailures", c.consecutiveFailures());
        m.put("lastError", c.lastError());
        m.put("updatedAt", c.updatedAt().toString());
        return m;
    }
}
