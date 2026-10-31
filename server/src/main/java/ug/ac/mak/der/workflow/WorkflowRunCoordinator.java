package ug.ac.mak.der.workflow;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/** §2.3.11 — Workflow Run Coordinator (spec §27–§33, §43).
 *
 *  <p>Orchestrates the full life-cycle of a workflow run:</p>
 *  <ol>
 *    <li>{@link #openRun(UUID, String, UUID)} — creates a new run in state OPEN.</li>
 *    <li>{@link #contribute} — operator submits a step payload. Coordinator
 *        checks dependency readiness (COMPLETES_BEFORE), upserts the
 *        contribution, re-runs the merge engine ({@link WorkflowCompiler}),
 *        updates the materialised canonical state, re-computes per-step
 *        readiness, publishes {@code workflow.step.ready} events, and
 *        — when every step has contributed — compiles the full submission
 *        and writes it to the operation journal for the DHIS2
 *        publisher to pick up.</li>
 *    <li>{@link #markRejected(UUID, String, UUID)} — supervisor rejects
 *        the run before submission.</li>
 *  </ol>
 *
 *  <p>Spec §11.1 (operation journal) is the durable history; spec §11.2
 *  (canonical state) is the current merged view stored in
 *  {@code canonical_workflow_state}.</p>
 */
@Service
public class WorkflowRunCoordinator {

    private static final Logger LOG = LoggerFactory.getLogger(WorkflowRunCoordinator.class);

    private final CaptureWorkflowService workflows;
    private final CaptureWorkflowRepository repo;
    private final CaptureWorkflowContributionRepository contributions;
    private final WorkflowCompiler compiler;
    private final OperationJournalRepository journal;
    private final ObjectMapper mapper;
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final ApplicationEventPublisher events;

    public WorkflowRunCoordinator(final CaptureWorkflowService workflows,
                                    final CaptureWorkflowRepository repo,
                                    final CaptureWorkflowContributionRepository contributions,
                                    final WorkflowCompiler compiler,
                                    final OperationJournalRepository journal,
                                    final ObjectMapper mapper,
                                    final JdbcTemplate jdbc,
                                    final Clock clock,
                                    final ApplicationEventPublisher events) {
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.repo = Objects.requireNonNull(repo, "repo");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
        this.compiler = Objects.requireNonNull(compiler, "compiler");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.events = Objects.requireNonNull(events, "events");
    }

    /* ─── 1. open ────────────────────────────────────────────────── */

    @Transactional
    public CaptureWorkflowRun openRun(final UUID workflowId,
                                        final String businessKey,
                                        final UUID actor) {
        final CaptureWorkflow w = workflows.get(workflowId)
                .orElseThrow(() -> new IllegalArgumentException("workflow not found: " + workflowId));
        if (!w.enabled()) {
            throw new IllegalStateException("workflow is disabled");
        }
        final Optional<CaptureWorkflowRun> existing = repo.findRunByKey(
                workflowId, w.version(), businessKey);
        if (existing.isPresent()) {
            return existing.get();
        }
        final Instant now = Instant.now(clock);
        final CaptureWorkflowRun run = new CaptureWorkflowRun(
                UUID.randomUUID(), workflowId, w.version(), businessKey,
                null, CaptureWorkflowRun.State.OPEN, now, now, actor,
                null, null);
        return repo.insertRun(run);
    }

    /* ─── 2. contribute ──────────────────────────────────────────── */

    public record ContributionResult(
            CaptureWorkflowRun run,
            Map<UUID, Readiness> readiness,
            boolean completed) { }

    /** Spec §30 — per-step readiness. */
    public enum Readiness { BLOCKED, READY, IN_PROGRESS, COMPLETE }

    @Transactional
    public ContributionResult contribute(final UUID runId, final UUID stepId,
                                           final String payloadJson,
                                           final UUID submittedBy,
                                           final UUID submittedDeviceId) {
        final CaptureWorkflowRun run = repo.findRun(runId)
                .orElseThrow(() -> new IllegalArgumentException("run not found: " + runId));
        if (run.state() == CaptureWorkflowRun.State.REJECTED
                || run.state() == CaptureWorkflowRun.State.COMPLETED) {
            throw new IllegalStateException("run is terminal: " + run.state());
        }
        final CaptureWorkflow w = workflows.get(run.workflowId())
                .orElseThrow(() -> new IllegalStateException("workflow row disappeared"));

        // Validate the step belongs to this workflow.
        final CaptureWorkflowStep step = w.steps().stream()
                .filter(s -> s.stepId().equals(stepId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "step " + stepId + " does not belong to workflow " + w.workflowId()));

        // Spec §28 — enforce dependency readiness. Reject if any
        // COMPLETES_BEFORE predecessor hasn't contributed yet.
        final Set<UUID> contributedStepIds = new HashSet<>();
        contributions.findByRun(runId).forEach((c) -> contributedStepIds.add(c.stepId()));
        for (final CaptureWorkflowDependency d : w.dependencies()) {
            if (d.stepId().equals(stepId)
                    && d.kind() == CaptureWorkflowDependency.Kind.COMPLETES_BEFORE
                    && !contributedStepIds.contains(d.dependsOnStepId())) {
                final CaptureWorkflowStep blocker = w.steps().stream()
                        .filter(s -> s.stepId().equals(d.dependsOnStepId()))
                        .findFirst().orElse(null);
                throw new IllegalStateException("step '"
                        + step.displayName()
                        + "' is blocked: '"
                        + (blocker == null ? d.dependsOnStepId().toString() : blocker.displayName())
                        + "' must complete first");
            }
        }

        // Upsert the contribution.
        contributions.upsert(new CaptureWorkflowContribution(
                UUID.randomUUID(), runId, stepId, payloadJson,
                submittedBy, submittedDeviceId, Instant.now(clock)));

        // Re-run merge engine → store canonical state.
        final List<CaptureWorkflowContribution> all = contributions.findByRun(runId);
        final Optional<WorkflowCompiler.CompileResult> merge = compiler.compile(w, all);
        upsertCanonicalState(runId, merge, w, all, submittedBy, submittedDeviceId);

        // Recompute readiness per step.
        final Map<UUID, Readiness> readiness = computeReadiness(w, all);

        // Transition state + publish events.
        boolean completed = false;
        if (allComplete(readiness)) {
            completeRun(run, w, merge, submittedBy);
            completed = true;
        } else if (run.state() == CaptureWorkflowRun.State.OPEN) {
            repo.updateRunState(runId, CaptureWorkflowRun.State.AWAITING, Instant.now(clock));
        }

        // §33 — emit workflow.step.ready events for every newly-READY step.
        readiness.entrySet().stream()
                .filter((e) -> e.getValue() == Readiness.READY)
                .forEach((e) -> events.publishEvent(new WorkflowStepReadyEvent(
                        run.workflowId(), runId, e.getKey())));

        final CaptureWorkflowRun refreshed = repo.findRun(runId).orElse(run);
        return new ContributionResult(refreshed, readiness, completed);
    }

    /* ─── 3. mark rejected ───────────────────────────────────────── */

    @Transactional
    public CaptureWorkflowRun markRejected(final UUID runId, final String reason,
                                             final UUID actor) {
        final CaptureWorkflowRun run = repo.findRun(runId)
                .orElseThrow(() -> new IllegalArgumentException("run not found: " + runId));
        repo.updateRunState(runId, CaptureWorkflowRun.State.REJECTED, Instant.now(clock));
        if (reason != null && !reason.isBlank()) {
            repo.setRunSubmission(runId, null, "rejected: " + reason, Instant.now(clock));
        }
        LOG.info("workflow run {} rejected by {}: {}", runId, actor, reason);
        return repo.findRun(runId).orElse(run);
    }

    /* ─── Dependency engine + readiness ──────────────────────────── */

    /** Computes per-step {@link Readiness} given the workflow's dependency
     *  graph and the set of contributions already received. */
    public Map<UUID, Readiness> computeReadiness(final CaptureWorkflow w,
                                                    final List<CaptureWorkflowContribution> all) {
        final Set<UUID> contributedStepIds = new HashSet<>();
        all.forEach((c) -> contributedStepIds.add(c.stepId()));
        final Map<UUID, List<UUID>> dependsOn = new HashMap<>();
        w.steps().forEach((s) -> dependsOn.put(s.stepId(), new ArrayList<>()));
        for (final CaptureWorkflowDependency d : w.dependencies()) {
            if (d.kind() == CaptureWorkflowDependency.Kind.COMPLETES_BEFORE) {
                dependsOn.get(d.stepId()).add(d.dependsOnStepId());
            }
        }
        final Map<UUID, Readiness> result = new LinkedHashMap<>();
        for (final CaptureWorkflowStep s : w.steps()) {
            if (contributedStepIds.contains(s.stepId())) {
                result.put(s.stepId(), Readiness.COMPLETE);
                continue;
            }
            final List<UUID> deps = dependsOn.get(s.stepId());
            final boolean anyBlocking = deps.stream()
                    .anyMatch((d) -> !contributedStepIds.contains(d));
            result.put(s.stepId(), anyBlocking ? Readiness.BLOCKED : Readiness.READY);
        }
        return result;
    }

    private boolean allComplete(final Map<UUID, Readiness> readiness) {
        return !readiness.isEmpty()
                && readiness.values().stream().allMatch((r) -> r == Readiness.COMPLETE);
    }

    /* ─── Canonical state storage ────────────────────────────────── */

    private void upsertCanonicalState(final UUID runId,
                                        final Optional<WorkflowCompiler.CompileResult> merge,
                                        final CaptureWorkflow w,
                                        final List<CaptureWorkflowContribution> all,
                                        final UUID lastUser, final UUID lastDevice) {
        final ObjectNode payload = merge.map(WorkflowCompiler.CompileResult::payload)
                .orElseGet(mapper::createObjectNode);
        final String completeness = all.isEmpty() ? "EMPTY"
                : (all.size() >= w.steps().size() ? "COMPLETE" : "PARTIAL");
        try {
            jdbc.update(
                "INSERT INTO der.canonical_workflow_state "
              + "(run_id, revision, payload, completeness, computed_at, "
              + " last_contributor_user_id, last_contributor_device_id) "
              + "VALUES (?, 1, ?::jsonb, ?, now(), ?, ?) "
              + "ON CONFLICT (run_id) DO UPDATE SET "
              + "  revision = canonical_workflow_state.revision + 1, "
              + "  payload = EXCLUDED.payload, "
              + "  completeness = EXCLUDED.completeness, "
              + "  computed_at = EXCLUDED.computed_at, "
              + "  last_contributor_user_id = EXCLUDED.last_contributor_user_id, "
              + "  last_contributor_device_id = EXCLUDED.last_contributor_device_id",
                runId, mapper.writeValueAsString(payload),
                completeness, lastUser, lastDevice);
        } catch (Exception ex) {
            LOG.warn("failed to upsert canonical state for run {}", runId, ex);
        }
    }

    /** Returns the current canonical state as a Map, or an empty Map
     *  if no contributions have landed yet. */
    public Map<String, Object> readCanonicalState(final UUID runId) {
        return jdbc.query(
            "SELECT revision, payload::text AS payload_text, completeness, "
          + "computed_at, last_contributor_user_id, last_contributor_device_id "
          + "FROM der.canonical_workflow_state WHERE run_id = ?",
            (rs) -> {
                if (!rs.next()) {
                    return Map.of();
                }
                final Map<String, Object> out = new LinkedHashMap<>();
                out.put("revision", rs.getInt("revision"));
                out.put("completeness", rs.getString("completeness"));
                out.put("computedAt", rs.getTimestamp("computed_at").toInstant().toString());
                out.put("lastContributorUserId",
                    rs.getString("last_contributor_user_id"));
                out.put("lastContributorDeviceId",
                    rs.getString("last_contributor_device_id"));
                try {
                    out.put("payload", mapper.readTree(rs.getString("payload_text")));
                } catch (Exception ex) {
                    out.put("payload", Map.of());
                }
                return out;
            }, runId);
    }

    /* ─── Complete + write to journal ────────────────────────────── */

    private void completeRun(final CaptureWorkflowRun run,
                               final CaptureWorkflow w,
                               final Optional<WorkflowCompiler.CompileResult> merge,
                               final UUID actor) {
        final Instant now = Instant.now(clock);
        if (merge.isEmpty()) {
            repo.setRunSubmission(run.runId(), null,
                "compile produced no payload", now);
            return;
        }
        try {
            final OperationJournalEntry.EntityType et = entityTypeFor(w);
            final OperationJournalEntry entry = new OperationJournalEntry(
                UUID.randomUUID(), et, w.boundMetadataId(),
                merge.get().payload(),
                OperationJournalEntry.State.PENDING,
                0, null, actor, now, now);
            final OperationJournalEntry saved = journal.insert(entry);
            repo.setRunSubmission(run.runId(), saved.operationId(), null, now);
            repo.updateRunState(run.runId(), CaptureWorkflowRun.State.COMPLETED, now);
            events.publishEvent(new WorkflowRunCompletedEvent(
                w.workflowId(), run.runId(), saved.operationId()));
            LOG.info("workflow run {} compiled + queued for sync as op {}",
                run.runId(), saved.operationId());
        } catch (Exception ex) {
            LOG.warn("submit failed for run {}", run.runId(), ex);
            repo.setRunSubmission(run.runId(), null, ex.getMessage(), now);
        }
    }

    private static OperationJournalEntry.EntityType entityTypeFor(final CaptureWorkflow w) {
        return switch (w.boundMetadataKind()) {
            case DATA_SET -> OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE;
            case PROGRAM -> OperationJournalEntry.EntityType.TRACKED_ENTITY;
            case PROGRAM_STAGE, PROGRAM_STAGE_SECTION ->
                OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT;
        };
    }

    /* ─── Events ─────────────────────────────────────────────────── */

    /** Spec §33 — workflow.step.ready */
    public record WorkflowStepReadyEvent(UUID workflowId, UUID runId, UUID stepId) { }

    /** Spec §33 — workflow.run.completed */
    public record WorkflowRunCompletedEvent(UUID workflowId, UUID runId,
                                               UUID submissionJournalOpId) { }
}
