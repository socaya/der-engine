package ug.ac.mak.der.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class CaptureWorkflowRecordsTest {

    private final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    @Test
    void workflowRejectsBlankDisplayName() {
        assertThatThrownBy(() -> new CaptureWorkflow(UUID.randomUUID(), "",
                CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1,
                NOW, NOW, null, List.of(), List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void workflowRejectsBlankMetadataId() {
        assertThatThrownBy(() -> new CaptureWorkflow(UUID.randomUUID(), "wf",
                CaptureWorkflow.BindingKind.DATA_SET, " ", true, 1,
                NOW, NOW, null, List.of(), List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void workflowRejectsZeroVersion() {
        assertThatThrownBy(() -> new CaptureWorkflow(UUID.randomUUID(), "wf",
                CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 0,
                NOW, NOW, null, List.of(), List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void workflowCopiesListsDefensively() {
        final List<CaptureWorkflowStep> steps = List.of();
        final CaptureWorkflow w = new CaptureWorkflow(UUID.randomUUID(), "wf",
                CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1,
                NOW, NOW, null, steps, null);
        assertThat(w.steps()).isNotNull();
        assertThat(w.dependencies()).isNotNull();
    }

    @Test
    void stepRejectsBlankDisplayName() {
        assertThatThrownBy(() -> new CaptureWorkflowStep(UUID.randomUUID(),
                UUID.randomUUID(), 0, " ",
                CaptureWorkflowStep.OwnerRole.OPERATOR,
                CaptureWorkflowStep.StepKind.CAPTURE, List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void stepRejectsNegativeOrdinal() {
        assertThatThrownBy(() -> new CaptureWorkflowStep(UUID.randomUUID(),
                UUID.randomUUID(), -1, "x",
                CaptureWorkflowStep.OwnerRole.OPERATOR,
                CaptureWorkflowStep.StepKind.CAPTURE, List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void stepFieldsAreCopiedDefensively() {
        final CaptureWorkflowStep s = new CaptureWorkflowStep(UUID.randomUUID(),
                UUID.randomUUID(), 0, "x",
                CaptureWorkflowStep.OwnerRole.OPERATOR,
                CaptureWorkflowStep.StepKind.CAPTURE, null);
        assertThat(s.fields()).isNotNull();
    }

    @Test
    void fieldRejectsBlankRef() {
        assertThatThrownBy(() -> new CaptureWorkflowField(UUID.randomUUID(), " ",
                CaptureWorkflowField.Requirement.REQUIRED))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void dependencyRejectsSelfLoop() {
        final UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> new CaptureWorkflowDependency(id, id,
                CaptureWorkflowDependency.Kind.COMPLETES_BEFORE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void runRejectsBlankBusinessKey() {
        assertThatThrownBy(() -> new CaptureWorkflowRun(UUID.randomUUID(),
                UUID.randomUUID(), 1, " ", null,
                CaptureWorkflowRun.State.OPEN, NOW, NOW, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void runRejectsZeroVersion() {
        assertThatThrownBy(() -> new CaptureWorkflowRun(UUID.randomUUID(),
                UUID.randomUUID(), 0, "key", null,
                CaptureWorkflowRun.State.OPEN, NOW, NOW, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void enumValuesSurface() {
        assertThat(CaptureWorkflow.BindingKind.values())
                .containsExactly(CaptureWorkflow.BindingKind.DATA_SET);
        assertThat(CaptureWorkflowStep.OwnerRole.values()).hasSize(3);
        assertThat(CaptureWorkflowStep.StepKind.values()).hasSize(4);
        assertThat(CaptureWorkflowField.Requirement.values()).hasSize(4);
        assertThat(CaptureWorkflowDependency.Kind.values())
                .containsExactly(CaptureWorkflowDependency.Kind.COMPLETES_BEFORE);
        assertThat(CaptureWorkflowRun.State.values()).hasSize(4);
    }
}
