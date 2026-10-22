package ug.ac.mak.der.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.device.EdgeDevice;
import ug.ac.mak.der.device.EdgeDeviceRepository;
import ug.ac.mak.der.workflow.CaptureWorkflowImportService.CanonicalDependency;
import ug.ac.mak.der.workflow.CaptureWorkflowImportService.CanonicalField;
import ug.ac.mak.der.workflow.CaptureWorkflowImportService.CanonicalStep;
import ug.ac.mak.der.workflow.CaptureWorkflowImportService.CanonicalWorkflow;
import ug.ac.mak.der.workflow.CaptureWorkflowImportService.ImportResult;

class CaptureWorkflowImportServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private CaptureWorkflowImportService svc(final CaptureWorkflowService workflows,
                                                final EdgeDeviceRepository devices) {
        return new CaptureWorkflowImportService(workflows, devices,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private CanonicalWorkflow sample(final UUID device) {
        return new CanonicalWorkflow(1, "wf", "DATA_SET", "ds1", true,
                List.of(
                        new CanonicalStep(0, "s0", "OPERATOR", device, "CAPTURE",
                                List.of(new CanonicalField("de.coc", "REQUIRED"))),
                        new CanonicalStep(1, "s1", "REVIEWER", null, "REVIEW", List.of())),
                List.of(new CanonicalDependency(1, 0, "COMPLETES_BEFORE")));
    }

    @Test
    void dryRunDoesNotPersist() {
        final CaptureWorkflowService workflows = mock(CaptureWorkflowService.class);
        final EdgeDeviceRepository devices = mock(EdgeDeviceRepository.class);
        when(devices.findById(any(UUID.class))).thenReturn(Optional.empty());
        final ImportResult r = svc(workflows, devices).importWorkflow(sample(null),
                true, UUID.randomUUID());
        assertThat(r.dryRun()).isTrue();
        assertThat(r.workflow().displayName()).isEqualTo("wf");
        verify(workflows, org.mockito.Mockito.never()).save(any(), any());
    }

    @Test
    void applyPersists() {
        final CaptureWorkflowService workflows = mock(CaptureWorkflowService.class);
        when(workflows.save(any(CaptureWorkflow.class), any(UUID.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        final EdgeDeviceRepository devices = mock(EdgeDeviceRepository.class);
        final ImportResult r = svc(workflows, devices).importWorkflow(sample(null),
                false, UUID.randomUUID());
        assertThat(r.dryRun()).isFalse();
        verify(workflows).save(any(), any());
    }

    @Test
    void scrubsUnknownOwnerDevice() {
        final CaptureWorkflowService workflows = mock(CaptureWorkflowService.class);
        when(workflows.save(any(), any())).thenAnswer(inv -> inv.getArgument(0));
        final EdgeDeviceRepository devices = mock(EdgeDeviceRepository.class);
        when(devices.findById(any(UUID.class))).thenReturn(Optional.empty());
        final UUID device = UUID.randomUUID();
        final ImportResult r = svc(workflows, devices).importWorkflow(sample(device),
                false, UUID.randomUUID());
        assertThat(r.warnings()).anySatisfy(s -> assertThat(s).contains("scrubbed"));
        assertThat(r.workflow().steps().get(0).ownerDeviceId()).isNull();
    }

    @Test
    void keepsKnownOwnerDevice() {
        final CaptureWorkflowService workflows = mock(CaptureWorkflowService.class);
        when(workflows.save(any(), any())).thenAnswer(inv -> inv.getArgument(0));
        final EdgeDeviceRepository devices = mock(EdgeDeviceRepository.class);
        final UUID device = UUID.randomUUID();
        when(devices.findById(device)).thenReturn(Optional.of(new EdgeDevice(
                device, null, "hash", NOW, null, null, null, "ua", null,
                EdgeDevice.Status.APPROVED)));
        final ImportResult r = svc(workflows, devices).importWorkflow(sample(device),
                false, UUID.randomUUID());
        assertThat(r.workflow().steps().get(0).ownerDeviceId()).isEqualTo(device);
    }

    @Test
    void rejectsWrongSchemaVersion() {
        final CaptureWorkflowImportService s = svc(
                mock(CaptureWorkflowService.class), mock(EdgeDeviceRepository.class));
        assertThatThrownBy(() -> s.importWorkflow(new CanonicalWorkflow(
                2, "x", "DATA_SET", "ds", true,
                List.of(new CanonicalStep(0, "s", "OPERATOR", null, "CAPTURE", List.of())),
                List.of()), true, UUID.randomUUID()))
                .hasMessageContaining("schemaVersion");
    }

    @Test
    void rejectsBlankDisplayName() {
        final CaptureWorkflowImportService s = svc(
                mock(CaptureWorkflowService.class), mock(EdgeDeviceRepository.class));
        assertThatThrownBy(() -> s.importWorkflow(new CanonicalWorkflow(
                1, " ", "DATA_SET", "ds", true,
                List.of(new CanonicalStep(0, "s", "OPERATOR", null, "CAPTURE", List.of())),
                List.of()), true, UUID.randomUUID()))
                .hasMessageContaining("displayName");
    }

    @Test
    void rejectsBlankBoundMetadataId() {
        final CaptureWorkflowImportService s = svc(
                mock(CaptureWorkflowService.class), mock(EdgeDeviceRepository.class));
        assertThatThrownBy(() -> s.importWorkflow(new CanonicalWorkflow(
                1, "x", "DATA_SET", "", true,
                List.of(new CanonicalStep(0, "s", "OPERATOR", null, "CAPTURE", List.of())),
                List.of()), true, UUID.randomUUID()))
                .hasMessageContaining("boundMetadataId");
    }

    @Test
    void rejectsEmptySteps() {
        final CaptureWorkflowImportService s = svc(
                mock(CaptureWorkflowService.class), mock(EdgeDeviceRepository.class));
        assertThatThrownBy(() -> s.importWorkflow(new CanonicalWorkflow(
                1, "x", "DATA_SET", "ds", true, List.of(), List.of()),
                true, UUID.randomUUID()))
                .hasMessageContaining("steps[] must not be empty");
    }

    @Test
    void rejectsNegativeOrdinal() {
        final CaptureWorkflowImportService s = svc(
                mock(CaptureWorkflowService.class), mock(EdgeDeviceRepository.class));
        assertThatThrownBy(() -> s.importWorkflow(new CanonicalWorkflow(
                1, "x", "DATA_SET", "ds", true,
                List.of(new CanonicalStep(-1, "s", "OPERATOR", null, "CAPTURE", List.of())),
                List.of()), true, UUID.randomUUID()))
                .hasMessageContaining("ordinals must be >= 0");
    }

    @Test
    void rejectsDuplicateOrdinals() {
        final CaptureWorkflowImportService s = svc(
                mock(CaptureWorkflowService.class), mock(EdgeDeviceRepository.class));
        assertThatThrownBy(() -> s.importWorkflow(new CanonicalWorkflow(
                1, "x", "DATA_SET", "ds", true,
                List.of(new CanonicalStep(0, "s0", "OPERATOR", null, "CAPTURE", List.of()),
                        new CanonicalStep(0, "s0b", "OPERATOR", null, "CAPTURE", List.of())),
                List.of()), true, UUID.randomUUID()))
                .hasMessageContaining("duplicate step ordinal");
    }

    @Test
    void dependencyWithUnknownOrdinalIsSkipped() {
        final CaptureWorkflowService workflows = mock(CaptureWorkflowService.class);
        when(workflows.save(any(), any())).thenAnswer(inv -> inv.getArgument(0));
        final EdgeDeviceRepository devices = mock(EdgeDeviceRepository.class);
        final ImportResult r = svc(workflows, devices).importWorkflow(new CanonicalWorkflow(
                1, "x", "DATA_SET", "ds", true,
                List.of(new CanonicalStep(0, "s", "OPERATOR", null, "CAPTURE", List.of())),
                List.of(new CanonicalDependency(0, 99, "COMPLETES_BEFORE"))),
                false, UUID.randomUUID());
        assertThat(r.workflow().dependencies()).isEmpty();
        assertThat(r.warnings()).anySatisfy(s -> assertThat(s).contains("unknown ordinal"));
    }

    @Test
    void selfDependencyWarns() {
        final CaptureWorkflowService workflows = mock(CaptureWorkflowService.class);
        when(workflows.save(any(), any())).thenAnswer(inv -> inv.getArgument(0));
        final EdgeDeviceRepository devices = mock(EdgeDeviceRepository.class);
        // Self-dep passes validate() with a warning but then fails at the record
        // ctor level (CaptureWorkflowDependency requires step != dependsOn).
        assertThatThrownBy(() -> svc(workflows, devices).importWorkflow(new CanonicalWorkflow(
                1, "x", "DATA_SET", "ds", true,
                List.of(new CanonicalStep(0, "s", "OPERATOR", null, "CAPTURE", List.of())),
                List.of(new CanonicalDependency(0, 0, "COMPLETES_BEFORE"))),
                false, UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void dryRunNeverPersistsEvenWithWarnings() {
        final CaptureWorkflowService workflows = mock(CaptureWorkflowService.class);
        final EdgeDeviceRepository devices = mock(EdgeDeviceRepository.class);
        when(devices.findById(any(UUID.class))).thenReturn(Optional.empty());
        final UUID device = UUID.randomUUID();
        final ImportResult r = svc(workflows, devices).importWorkflow(sample(device),
                true, UUID.randomUUID());
        assertThat(r.dryRun()).isTrue();
        assertThat(r.warnings()).isNotEmpty();
        verifyNoInteractions(workflows);
    }
}
