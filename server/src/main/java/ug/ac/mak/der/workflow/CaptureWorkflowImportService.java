package ug.ac.mak.der.workflow;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.device.EdgeDeviceRepository;

/**
 * ADR-0024 D-WIX-5/6/7. Translates the canonical workflow JSON shape
 * into the internal domain model, scrubs {@code ownerDeviceId}s that
 * don't exist on this install, and supports a dry-run that returns
 * what would be imported without persisting.
 */
@Service
@ConditionalOnBean(CaptureWorkflowService.class)
public class CaptureWorkflowImportService {

    private static final Logger LOG = LoggerFactory.getLogger(CaptureWorkflowImportService.class);
    static final int SCHEMA_VERSION = 1;

    private final CaptureWorkflowService workflows;
    private final EdgeDeviceRepository devices;
    private final Clock clock;

    public CaptureWorkflowImportService(final CaptureWorkflowService workflows,
                                          final EdgeDeviceRepository devices,
                                          final Clock clock) {
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.devices = Objects.requireNonNull(devices, "devices");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public ImportResult importWorkflow(final CanonicalWorkflow canonical,
                                        final boolean dryRun,
                                        final UUID actor) {
        Objects.requireNonNull(canonical, "canonical");
        final List<String> warnings = new ArrayList<>();
        validate(canonical, warnings);
        final UUID workflowId = UUID.randomUUID();
        final List<CaptureWorkflowStep> steps = new ArrayList<>();
        final List<UUID> ordinalToStepId = new ArrayList<>();
        for (int i = 0; i < canonical.steps().size(); i++) {
            final CanonicalStep s = canonical.steps().get(i);
            final UUID stepId = UUID.randomUUID();
            ordinalToStepId.add(stepId);
            final UUID resolvedDevice = resolveOwnerDevice(s.ownerDeviceId(), s.ordinal(), warnings);
            final List<CaptureWorkflowField> fields = new ArrayList<>();
            for (final CanonicalField f : s.fields()) {
                fields.add(new CaptureWorkflowField(stepId, f.fieldRef(),
                        CaptureWorkflowField.Requirement.valueOf(
                                f.requirement().toUpperCase(Locale.ROOT))));
            }
            steps.add(new CaptureWorkflowStep(stepId, workflowId, s.ordinal(),
                    s.displayName(),
                    CaptureWorkflowStep.OwnerRole.valueOf(s.ownerRole().toUpperCase(Locale.ROOT)),
                    resolvedDevice,
                    CaptureWorkflowStep.StepKind.valueOf(s.stepKind().toUpperCase(Locale.ROOT)),
                    fields));
        }
        final List<CaptureWorkflowDependency> deps = new ArrayList<>();
        for (final CanonicalDependency d : canonical.dependencies()) {
            final UUID from = ordinalForDep(ordinalToStepId, canonical.steps(),
                    d.fromOrdinal(), warnings);
            final UUID to = ordinalForDep(ordinalToStepId, canonical.steps(),
                    d.toOrdinal(), warnings);
            if (from == null || to == null) {
                continue;
            }
            deps.add(new CaptureWorkflowDependency(from, to,
                    CaptureWorkflowDependency.Kind.valueOf(d.kind().toUpperCase(Locale.ROOT))));
        }
        final Instant now = Instant.now(clock);
        final CaptureWorkflow built = new CaptureWorkflow(workflowId,
                canonical.displayName(),
                CaptureWorkflow.BindingKind.valueOf(
                        canonical.boundMetadataKind().toUpperCase(Locale.ROOT)),
                canonical.boundMetadataId(), canonical.enabled(), 1,
                now, now, actor, steps, deps);
        if (dryRun) {
            return new ImportResult(built, warnings, true);
        }
        final CaptureWorkflow saved = workflows.save(built, actor);
        return new ImportResult(saved, warnings, false);
    }

    private UUID resolveOwnerDevice(final UUID ownerDeviceId, final int stepOrdinal,
                                      final List<String> warnings) {
        if (ownerDeviceId == null) {
            return null;
        }
        if (devices.findById(ownerDeviceId).isPresent()) {
            return ownerDeviceId;
        }
        warnings.add("step " + stepOrdinal + ": unknown ownerDeviceId "
                + ownerDeviceId + " scrubbed to null (ADR-0024 D-WIX-6)");
        LOG.info("import scrubbed unknown ownerDeviceId {} on step ord={}",
                ownerDeviceId, stepOrdinal);
        return null;
    }

    private UUID ordinalForDep(final List<UUID> ordinalToStepId,
                                 final List<CanonicalStep> steps,
                                 final int ordinal, final List<String> warnings) {
        for (int i = 0; i < steps.size(); i++) {
            if (steps.get(i).ordinal() == ordinal) {
                return ordinalToStepId.get(i);
            }
        }
        warnings.add("dependency references unknown ordinal " + ordinal + " (ignored)");
        return null;
    }

    private void validate(final CanonicalWorkflow w, final List<String> warnings) {
        if (w.schemaVersion() != SCHEMA_VERSION) {
            throw new IllegalArgumentException("schemaVersion must be " + SCHEMA_VERSION
                    + " (got " + w.schemaVersion() + ")");
        }
        if (w.displayName() == null || w.displayName().isBlank()) {
            throw new IllegalArgumentException("displayName required");
        }
        if (w.boundMetadataId() == null || w.boundMetadataId().isBlank()) {
            throw new IllegalArgumentException("boundMetadataId required");
        }
        if (w.steps() == null || w.steps().isEmpty()) {
            throw new IllegalArgumentException("steps[] must not be empty");
        }
        final Set<Integer> seen = new HashSet<>();
        for (final CanonicalStep s : w.steps()) {
            if (s.ordinal() < 0) {
                throw new IllegalArgumentException(
                        "step ordinals must be >= 0 (got " + s.ordinal() + ")");
            }
            if (!seen.add(s.ordinal())) {
                throw new IllegalArgumentException(
                        "duplicate step ordinal: " + s.ordinal());
            }
        }
        if (w.dependencies() != null) {
            for (final CanonicalDependency d : w.dependencies()) {
                if (d.fromOrdinal() == d.toOrdinal()) {
                    warnings.add("dependency with equal from/to ordinal "
                            + d.fromOrdinal() + " ignored");
                }
            }
        }
    }

    public record ImportResult(CaptureWorkflow workflow, List<String> warnings,
                                 boolean dryRun) { }

    public record CanonicalWorkflow(int schemaVersion, String displayName,
                                      String boundMetadataKind, String boundMetadataId,
                                      boolean enabled, List<CanonicalStep> steps,
                                      List<CanonicalDependency> dependencies) {
        public CanonicalWorkflow {
            steps = steps == null ? List.of() : List.copyOf(steps);
            dependencies = dependencies == null ? List.of() : List.copyOf(dependencies);
        }
    }

    public record CanonicalStep(int ordinal, String displayName, String ownerRole,
                                  UUID ownerDeviceId, String stepKind,
                                  List<CanonicalField> fields) {
        public CanonicalStep {
            fields = fields == null ? List.of() : List.copyOf(fields);
        }
    }

    public record CanonicalField(String fieldRef, String requirement) { }

    public record CanonicalDependency(int fromOrdinal, int toOrdinal, String kind) { }
}
