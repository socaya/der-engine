package ug.ac.mak.der.workflow;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

/**
 * ADR-0018 slice A: catalogue + CRUD + first-step hand-off semantics.
 *
 * <p>Slice A does not advance runs through steps or wire into the
 * journal drain — slice B (`der-1.3.0`) owns that. This service lets
 * admins model workflows now so slice B can turn them on.</p>
 */
@Service
@ConditionalOnBean(CaptureWorkflowRepository.class)
public class CaptureWorkflowService {

    private final CaptureWorkflowRepository repo;

    public CaptureWorkflowService(final CaptureWorkflowRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    public List<CaptureWorkflow> list() {
        return repo.findAll();
    }

    public Optional<CaptureWorkflow> get(final UUID workflowId) {
        return repo.findById(workflowId);
    }

    /**
     * Writes the workflow. If a previous version with the same id
     * exists AND the shape of steps/fields/dependencies has changed,
     * bumps the version (so in-flight runs stay on the old version
     * per ADR-0018 D17).
     */
    public CaptureWorkflow save(final CaptureWorkflow incoming, final UUID actor) {
        Objects.requireNonNull(incoming, "incoming");
        final Optional<CaptureWorkflow> existing = repo.findById(incoming.workflowId());
        final int version;
        final Instant createdAt;
        final UUID createdBy;
        final Instant now = Instant.now();
        if (existing.isEmpty()) {
            version = 1;
            createdAt = now;
            createdBy = actor;
        } else {
            final CaptureWorkflow old = existing.get();
            createdAt = old.createdAt();
            createdBy = old.createdBy();
            version = shapeChanged(old, incoming) ? old.version() + 1 : old.version();
        }
        final CaptureWorkflow toStore = new CaptureWorkflow(
                incoming.workflowId(), incoming.displayName(),
                incoming.boundMetadataKind(), incoming.boundMetadataId(),
                incoming.enabled(), version, createdAt, now, createdBy,
                incoming.steps(), incoming.dependencies());
        return repo.upsert(toStore);
    }

    public int delete(final UUID workflowId) {
        return repo.delete(workflowId);
    }

    public Optional<CaptureWorkflow> resolveForDataSet(final String dataSetId) {
        return repo.findEnabledForBinding(CaptureWorkflow.BindingKind.DATA_SET, dataSetId);
    }

    public Optional<CaptureWorkflow> resolveForProgram(final String programId) {
        return repo.findEnabledForBinding(CaptureWorkflow.BindingKind.PROGRAM, programId);
    }

    public Optional<CaptureWorkflow> resolveForProgramStage(final String programStageId) {
        return repo.findEnabledForBinding(
                CaptureWorkflow.BindingKind.PROGRAM_STAGE, programStageId);
    }

    /**
     * Starts (or returns the existing) run for this
     * {@code workflowId}/{@code businessKey}. Idempotent — repeated
     * calls return the already-open run.
     */
    public CaptureWorkflowRun startRun(final UUID workflowId, final String businessKey,
                                         final UUID actor) {
        final CaptureWorkflow w = get(workflowId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "workflow " + workflowId + " not found"));
        final Optional<CaptureWorkflowRun> existing = repo.findRunByKey(
                workflowId, w.version(), businessKey);
        if (existing.isPresent()) {
            return existing.get();
        }
        final UUID firstStepId = w.steps().isEmpty() ? null : w.steps().get(0).stepId();
        final Instant now = Instant.now();
        return repo.insertRun(new CaptureWorkflowRun(
                UUID.randomUUID(), workflowId, w.version(), businessKey,
                firstStepId, CaptureWorkflowRun.State.OPEN, now, now, actor));
    }

    public List<CaptureWorkflowRun> runs(final UUID workflowId) {
        return repo.findRuns(workflowId);
    }

    /**
     * ADR-0026 D-RST-1/2. Advances the run's state based on
     * contribution count. Called from the ingest hook after each
     * upsert. Idempotent: COMPLETED runs stay COMPLETED. Returns
     * {@code true} iff the state transitioned to {@code COMPLETED}
     * this call (so the caller can audit the completion exactly
     * once — D-RST-3).
     */
    public boolean advanceRunState(final UUID runId) {
        final Optional<CaptureWorkflowRun> maybeRun = repo.findRun(runId);
        if (maybeRun.isEmpty()) {
            return false;
        }
        final CaptureWorkflowRun run = maybeRun.get();
        if (run.state() == CaptureWorkflowRun.State.COMPLETED
                || run.state() == CaptureWorkflowRun.State.REJECTED) {
            return false;
        }
        final Optional<CaptureWorkflow> maybeWorkflow = repo.findById(run.workflowId());
        if (maybeWorkflow.isEmpty()) {
            return false;
        }
        final int steps = maybeWorkflow.get().steps().size();
        final int contributions = repo.countContributions(runId);
        final Instant now = Instant.now();
        if (steps > 0 && contributions >= steps) {
            repo.updateRunState(runId, CaptureWorkflowRun.State.COMPLETED, now);
            return true;
        }
        if (contributions > 0 && run.state() == CaptureWorkflowRun.State.OPEN) {
            repo.updateRunState(runId, CaptureWorkflowRun.State.AWAITING, now);
        }
        return false;
    }

    static boolean shapeChanged(final CaptureWorkflow a, final CaptureWorkflow b) {
        if (a.steps().size() != b.steps().size()) {
            return true;
        }
        if (a.dependencies().size() != b.dependencies().size()) {
            return true;
        }
        for (int i = 0; i < a.steps().size(); i++) {
            final CaptureWorkflowStep as = a.steps().get(i);
            final CaptureWorkflowStep bs = b.steps().get(i);
            if (!as.ownerRole().equals(bs.ownerRole())
                    || !as.stepKind().equals(bs.stepKind())
                    || as.fields().size() != bs.fields().size()) {
                return true;
            }
        }
        return false;
    }
}
