package ug.ac.mak.der.workflow;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * ADR-0025 post-handler widened by ADR-0026 D-RST-4 to cover
 * event + tracker ingest. Buffers the body as a step contribution
 * when the request carries workflow headers and the handler returned
 * 2xx, then advances run state. Fail-open on any error (ADR-0004).
 */
@Component
@ConditionalOnBean(CaptureWorkflowService.class)
public class CaptureWorkflowContributionIngest implements HandlerInterceptor {

    private static final Logger LOG =
            LoggerFactory.getLogger(CaptureWorkflowContributionIngest.class);
    static final String RUN_HEADER = "X-DER-Workflow-Run";
    static final String STEP_HEADER = "X-DER-Workflow-Step";
    static final String DEVICE_HEADER = "X-DER-Device-Id";

    private final CaptureWorkflowService workflows;
    private final CaptureWorkflowContributionRepository contributions;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    public CaptureWorkflowContributionIngest(final CaptureWorkflowService workflows,
                                               final CaptureWorkflowContributionRepository contributions,
                                               final SecurityAuditRepository audit,
                                               final ObjectMapper mapper,
                                               final Clock clock) {
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Override
    public void afterCompletion(final HttpServletRequest request,
                                  final HttpServletResponse response,
                                  final Object handler,
                                  final Exception ex) {
        try {
            if (ex != null) {
                return;
            }
            if (response.getStatus() / 100 != 2) {
                return;
            }
            if (!shouldIngest(request.getRequestURI(), request.getMethod())) {
                return;
            }
            final String runKey = request.getHeader(RUN_HEADER);
            final String stepHeader = request.getHeader(STEP_HEADER);
            if (runKey == null || runKey.isBlank() || stepHeader == null
                    || stepHeader.isBlank()) {
                return;
            }
            final int ordinal;
            try {
                ordinal = Integer.parseInt(stepHeader.trim());
            } catch (NumberFormatException nfe) {
                LOG.warn("ignoring non-integer {} header: {}", STEP_HEADER, stepHeader);
                return;
            }
            final JsonNode root = readRoot(request);
            if (root == null) {
                return;
            }
            final Optional<CaptureWorkflow> workflow = resolveWorkflow(root);
            if (workflow.isEmpty()) {
                return;
            }
            final CaptureWorkflow w = workflow.get();
            final Optional<CaptureWorkflowStep> step = w.steps().stream()
                    .filter(s -> s.ordinal() == ordinal)
                    .findFirst();
            if (step.isEmpty()) {
                LOG.warn("workflow {} has no step ordinal {}", w.workflowId(), ordinal);
                return;
            }
            final UUID actor = principalId(request);
            final CaptureWorkflowRun run = workflows.startRun(w.workflowId(), runKey, actor);
            contributions.upsert(new CaptureWorkflowContribution(
                    UUID.randomUUID(), run.runId(), step.get().stepId(),
                    root.toString(), actor,
                    parseDeviceHeader(request.getHeader(DEVICE_HEADER)),
                    Instant.now(clock)));
            final boolean completed = workflows.advanceRunState(run.runId());
            if (completed) {
                emitCompletion(request, w, run);
            }
        } catch (RuntimeException unexpected) {
            LOG.warn("contribution ingest failed; dropping (ADR-0025 D-REC-7): {}",
                    unexpected.getMessage());
        }
    }

    private Optional<CaptureWorkflow> resolveWorkflow(final JsonNode root) {
        if (root.has("dataSet") && root.get("dataSet").isTextual()) {
            return workflows.resolveForDataSet(root.get("dataSet").asText());
        }
        if (root.has("programStage") && root.get("programStage").isTextual()) {
            final Optional<CaptureWorkflow> ps =
                    workflows.resolveForProgramStage(root.get("programStage").asText());
            if (ps.isPresent()) {
                return ps;
            }
        }
        if (root.has("program") && root.get("program").isTextual()) {
            return workflows.resolveForProgram(root.get("program").asText());
        }
        return Optional.empty();
    }

    private void emitCompletion(final HttpServletRequest request, final CaptureWorkflow w,
                                  final CaptureWorkflowRun run) {
        try {
            audit.append(new AuditEvent(
                    "WORKFLOW_RUN_COMPLETED",
                    AuditEvent.Outcome.SUCCESS,
                    principalId(request), null,
                    request.getRemoteAddr(),
                    request.getHeader("User-Agent"),
                    java.util.Map.of(
                            "workflowId", w.workflowId().toString(),
                            "runId", run.runId().toString(),
                            "businessKey", run.businessKey())),
                    Instant.now(clock));
        } catch (RuntimeException ex) {
            LOG.warn("audit append for WORKFLOW_RUN_COMPLETED failed: {}", ex.getMessage());
        }
    }

    static boolean shouldIngest(final String path, final String method) {
        if (path == null || method == null) {
            return false;
        }
        if (!"POST".equals(method) && !"PUT".equals(method) && !"PATCH".equals(method)) {
            return false;
        }
        return "/api/dataValueSets".equals(path)
                || "/api/events".equals(path)
                || "/api/tracker/events".equals(path)
                || "/api/tracker/enrollments".equals(path);
    }

    private JsonNode readRoot(final HttpServletRequest request) {
        try {
            return mapper.readTree(request.getReader());
        } catch (IOException ex) {
            LOG.debug("could not read body for contribution ingest: {}", ex.getMessage());
            return null;
        }
    }

    private static UUID principalId(final HttpServletRequest request) {
        final Object principal = request.getUserPrincipal();
        if (principal instanceof EdgeUserPrincipal p) {
            return p.userId();
        }
        return null;
    }

    private static UUID parseDeviceHeader(final String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
