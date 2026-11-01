package ug.ac.mak.der.web;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.workflow.CaptureWorkflow;
import ug.ac.mak.der.workflow.CaptureWorkflowService;
import ug.ac.mak.der.workflow.CaptureWorkflowStepTransitionRepository;
import ug.ac.mak.der.workflow.CaptureWorkflowStepTransitionRepository.DeviceMetric;
import ug.ac.mak.der.workflow.CaptureWorkflowStepTransitionRepository.StepMetric;
import ug.ac.mak.der.device.EdgeDeviceRepository;

/**
 * §2.3.60 — admin-side workflow metrics. Aggregates step-transition
 * rows (V067) into wait + turnaround percentiles over a trailing
 * window, grouped per step and per device. Read-only; used by the
 * Workflow monitoring screen.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/workflows/metrics",
                 produces = MediaType.APPLICATION_JSON_VALUE)
public class WorkflowMetricsController {

    private final CaptureWorkflowStepTransitionRepository transitions;
    private final CaptureWorkflowService workflows;
    private final EdgeDeviceRepository devices;

    public WorkflowMetricsController(
            final CaptureWorkflowStepTransitionRepository transitions,
            final CaptureWorkflowService workflows,
            final EdgeDeviceRepository devices) {
        this.transitions = Objects.requireNonNull(transitions, "transitions");
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.devices = Objects.requireNonNull(devices, "devices");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> metrics(
            @RequestParam(name = "windowHours", defaultValue = "24") final int windowHours) {
        final int clamped = Math.max(1, Math.min(windowHours, 24 * 30));
        final Duration window = Duration.ofHours(clamped);

        final List<StepMetric> stepRows = transitions.stepMetrics(window);
        final List<DeviceMetric> deviceRows = transitions.deviceMetrics(window);

        final List<Map<String, Object>> perStep = new java.util.ArrayList<>();
        for (final StepMetric s : stepRows) {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("workflowId", s.workflowId().toString());
            row.put("workflowName", workflows.get(s.workflowId())
                    .map(CaptureWorkflow::displayName).orElse(null));
            row.put("stepId", s.stepId().toString());
            row.put("stepName", workflows.get(s.workflowId())
                    .flatMap((w) -> w.steps().stream()
                        .filter((st) -> st.stepId().equals(s.stepId()))
                        .findFirst())
                    .map((st) -> st.displayName()).orElse(null));
            row.put("completedCount", s.completedCount());
            row.put("turnaroundP50Ms", s.turnaroundP50Ms());
            row.put("turnaroundP95Ms", s.turnaroundP95Ms());
            row.put("turnaroundMaxMs", s.turnaroundMaxMs());
            perStep.add(row);
        }

        final List<Map<String, Object>> perDevice = new java.util.ArrayList<>();
        for (final DeviceMetric d : deviceRows) {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("deviceId", d.deviceId().toString());
            row.put("deviceName", devices.findById(d.deviceId())
                    .map((dev) -> dev.displayName()).orElse(null));
            row.put("completedCount", d.completedCount());
            row.put("turnaroundP50Ms", d.turnaroundP50Ms());
            row.put("turnaroundP95Ms", d.turnaroundP95Ms());
            perDevice.add(row);
        }

        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("windowHours", clamped);
        body.put("perStep", perStep);
        body.put("perDevice", perDevice);
        return ResponseEntity.ok(body);
    }
}
