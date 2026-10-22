package ug.ac.mak.der.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class CaptureWorkflowServiceTest {

    private final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private CaptureWorkflow sample(final UUID id, final int version, final int stepCount) {
        final java.util.List<CaptureWorkflowStep> steps = new java.util.ArrayList<>();
        for (int i = 0; i < stepCount; i++) {
            steps.add(new CaptureWorkflowStep(UUID.randomUUID(), id, i, "s" + i,
                    CaptureWorkflowStep.OwnerRole.OPERATOR,
                    CaptureWorkflowStep.StepKind.CAPTURE, List.of()));
        }
        return new CaptureWorkflow(id, "wf", CaptureWorkflow.BindingKind.DATA_SET, "ds1",
                true, version, NOW, NOW, null, steps, List.of());
    }

    @Test
    void listDelegates() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        when(repo.findAll()).thenReturn(List.of());
        assertThat(new CaptureWorkflowService(repo).list()).isEmpty();
    }

    @Test
    void getDelegates() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(sample(id, 1, 0)));
        assertThat(new CaptureWorkflowService(repo).get(id)).isPresent();
    }

    @Test
    void saveFreshCreatesVersion1() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        when(repo.findById(any())).thenReturn(Optional.empty());
        when(repo.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        final CaptureWorkflow w = sample(UUID.randomUUID(), 99, 1);
        final CaptureWorkflow saved = new CaptureWorkflowService(repo).save(w, UUID.randomUUID());
        assertThat(saved.version()).isEqualTo(1);
    }

    @Test
    void saveKeepsVersionWhenShapeIdentical() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        final UUID id = UUID.randomUUID();
        final CaptureWorkflow existing = sample(id, 3, 2);
        when(repo.findById(id)).thenReturn(Optional.of(existing));
        when(repo.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        final CaptureWorkflow saved = new CaptureWorkflowService(repo)
                .save(existing, UUID.randomUUID());
        assertThat(saved.version()).isEqualTo(3);
    }

    @Test
    void saveBumpsVersionWhenStepCountChanges() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(sample(id, 5, 2)));
        when(repo.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        final CaptureWorkflow saved = new CaptureWorkflowService(repo)
                .save(sample(id, 5, 3), UUID.randomUUID());
        assertThat(saved.version()).isEqualTo(6);
    }

    @Test
    void saveBumpsVersionWhenStepKindChanges() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        final UUID id = UUID.randomUUID();
        final CaptureWorkflow a = sample(id, 2, 1);
        final CaptureWorkflow b = new CaptureWorkflow(id, "wf",
                CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 2, NOW, NOW, null,
                List.of(new CaptureWorkflowStep(a.steps().get(0).stepId(), id, 0, "s0",
                        CaptureWorkflowStep.OwnerRole.OPERATOR,
                        CaptureWorkflowStep.StepKind.APPROVE, List.of())),
                List.of());
        when(repo.findById(id)).thenReturn(Optional.of(a));
        when(repo.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        assertThat(new CaptureWorkflowService(repo).save(b, UUID.randomUUID()).version())
                .isEqualTo(3);
    }

    @Test
    void deleteDelegates() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.delete(id)).thenReturn(1);
        assertThat(new CaptureWorkflowService(repo).delete(id)).isEqualTo(1);
    }

    @Test
    void resolveForDataSetDelegates() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        when(repo.findEnabledForBinding(CaptureWorkflow.BindingKind.DATA_SET, "ds1"))
                .thenReturn(Optional.empty());
        assertThat(new CaptureWorkflowService(repo).resolveForDataSet("ds1")).isEmpty();
    }

    @Test
    void startRunRejectsMissingWorkflow() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        when(repo.findById(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> new CaptureWorkflowService(repo)
                .startRun(UUID.randomUUID(), "key", UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void startRunReturnsExistingRun() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        final UUID id = UUID.randomUUID();
        final CaptureWorkflow w = sample(id, 1, 1);
        when(repo.findById(id)).thenReturn(Optional.of(w));
        final CaptureWorkflowRun existing = new CaptureWorkflowRun(UUID.randomUUID(),
                id, 1, "key", w.steps().get(0).stepId(),
                CaptureWorkflowRun.State.OPEN, NOW, NOW, null);
        when(repo.findRunByKey(id, 1, "key")).thenReturn(Optional.of(existing));
        assertThat(new CaptureWorkflowService(repo).startRun(id, "key", UUID.randomUUID()))
                .isSameAs(existing);
    }

    @Test
    void startRunCreatesFreshRun() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        final UUID id = UUID.randomUUID();
        final CaptureWorkflow w = sample(id, 1, 2);
        when(repo.findById(id)).thenReturn(Optional.of(w));
        when(repo.findRunByKey(any(), any(Integer.class), any())).thenReturn(Optional.empty());
        when(repo.insertRun(any())).thenAnswer(inv -> inv.getArgument(0));
        final CaptureWorkflowRun run = new CaptureWorkflowService(repo)
                .startRun(id, "ou-1/202604", UUID.randomUUID());
        assertThat(run.state()).isEqualTo(CaptureWorkflowRun.State.OPEN);
        assertThat(run.currentStepId()).isEqualTo(w.steps().get(0).stepId());
        verify(repo).insertRun(any(CaptureWorkflowRun.class));
    }

    @Test
    void startRunHandlesEmptyStepList() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(sample(id, 1, 0)));
        when(repo.findRunByKey(any(), any(Integer.class), any())).thenReturn(Optional.empty());
        when(repo.insertRun(any())).thenAnswer(inv -> inv.getArgument(0));
        final CaptureWorkflowRun run = new CaptureWorkflowService(repo)
                .startRun(id, "key", UUID.randomUUID());
        assertThat(run.currentStepId()).isNull();
    }

    @Test
    void runsDelegates() {
        final CaptureWorkflowRepository repo = mock(CaptureWorkflowRepository.class);
        when(repo.findRuns(any(UUID.class))).thenReturn(List.of());
        assertThat(new CaptureWorkflowService(repo).runs(UUID.randomUUID())).isEmpty();
    }

    @Test
    void shapeChangedDetectsOwnerRoleAndFieldCount() {
        final UUID id = UUID.randomUUID();
        final CaptureWorkflow a = sample(id, 1, 1);
        final CaptureWorkflow b = new CaptureWorkflow(id, "wf",
                CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1, NOW, NOW, null,
                List.of(new CaptureWorkflowStep(a.steps().get(0).stepId(), id, 0, "s0",
                        CaptureWorkflowStep.OwnerRole.REVIEWER,
                        CaptureWorkflowStep.StepKind.CAPTURE, List.of())),
                List.of());
        assertThat(CaptureWorkflowService.shapeChanged(a, b)).isTrue();
    }
}
