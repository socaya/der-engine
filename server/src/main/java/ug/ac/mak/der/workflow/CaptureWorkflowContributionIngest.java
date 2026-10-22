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

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * ADR-0025 post-handler. When the request carries workflow headers
 * and the handler returned 2xx, buffers the body as a step
 * contribution. Fail-open on any error (ADR-0004 — capture is always
 * available).
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
    private final ObjectMapper mapper;
    private final Clock clock;

    public CaptureWorkflowContributionIngest(final CaptureWorkflowService workflows,
                                               final CaptureWorkflowContributionRepository contributions,
                                               final ObjectMapper mapper,
                                               final Clock clock) {
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
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
            if (root == null || !root.has("dataSet") || !root.get("dataSet").isTextual()) {
                return;
            }
            final String dataSetId = root.get("dataSet").asText();
            final Optional<CaptureWorkflow> workflow = workflows.resolveForDataSet(dataSetId);
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
        } catch (RuntimeException unexpected) {
            LOG.warn("contribution ingest failed; dropping (ADR-0025 D-REC-7): {}",
                    unexpected.getMessage());
        }
    }

    static boolean shouldIngest(final String path, final String method) {
        if (path == null || method == null) {
            return false;
        }
        if (!"POST".equals(method) && !"PUT".equals(method) && !"PATCH".equals(method)) {
            return false;
        }
        return "/api/dataValueSets".equals(path);
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
