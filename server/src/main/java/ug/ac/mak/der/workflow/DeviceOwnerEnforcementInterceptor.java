package ug.ac.mak.der.workflow;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * ADR-0023. Rejects workflow-bound writes from devices that do not
 * own any step in the applicable workflow. Runs after
 * {@code OrgUnitScopeInterceptor} so the 403 is only emitted when the
 * org-unit check already passed.
 *
 * <p>Fail-open on lookup errors (ADR-0023 D-DOE-4) — "capture is
 * always available" from ADR-0004 trumps strict enforcement.</p>
 */
@Component
@ConditionalOnBean(CaptureWorkflowService.class)
public class DeviceOwnerEnforcementInterceptor implements HandlerInterceptor {

    private static final Logger LOG =
            LoggerFactory.getLogger(DeviceOwnerEnforcementInterceptor.class);
    static final String DEVICE_HEADER = "X-DER-Device-Id";

    private final CaptureWorkflowService workflows;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    public DeviceOwnerEnforcementInterceptor(final CaptureWorkflowService workflows,
                                              final SecurityAuditRepository audit,
                                              final ObjectMapper mapper,
                                              final Clock clock) {
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Override
    public boolean preHandle(final HttpServletRequest request,
                              final HttpServletResponse response,
                              final Object handler) throws IOException {
        final String method = request.getMethod();
        if (!"POST".equals(method) && !"PUT".equals(method) && !"PATCH".equals(method)) {
            return true;
        }
        if (!shouldGuard(request.getRequestURI())) {
            return true;
        }
        final String dataSetId = sniffDataSetId(request);
        if (dataSetId == null) {
            return true;
        }
        final Optional<CaptureWorkflow> workflow;
        try {
            workflow = workflows.resolveForDataSet(dataSetId);
        } catch (RuntimeException ex) {
            LOG.warn("workflow lookup failed; failing open (ADR-0023 D-DOE-4): {}",
                    ex.getMessage());
            return true;
        }
        if (workflow.isEmpty()) {
            return true;
        }
        final CaptureWorkflow w = workflow.get();
        final boolean anyDeviceOwned = w.steps().stream()
                .anyMatch(s -> s.ownerDeviceId() != null);
        if (!anyDeviceOwned) {
            return true;
        }
        final String rawHeader = request.getHeader(DEVICE_HEADER);
        if (rawHeader == null || rawHeader.isBlank()) {
            return reject(response, w, request, "MISSING_DEVICE_HEADER",
                    "capture-workflow " + w.workflowId()
                            + " requires an X-DER-Device-Id header");
        }
        final UUID device;
        try {
            device = UUID.fromString(rawHeader.trim());
        } catch (IllegalArgumentException ex) {
            return reject(response, w, request, "DEVICE_OWNER_MISMATCH",
                    "X-DER-Device-Id is not a valid UUID");
        }
        final boolean owns = w.steps().stream()
                .map(CaptureWorkflowStep::ownerDeviceId)
                .anyMatch(id -> id != null && id.equals(device));
        if (!owns) {
            return reject(response, w, request, "DEVICE_OWNER_MISMATCH",
                    "device " + device
                            + " does not own any step in workflow " + w.workflowId());
        }
        return true;
    }

    static boolean shouldGuard(final String path) {
        if (path == null) {
            return false;
        }
        return path.equals("/api/dataValueSets");
    }

    private String sniffDataSetId(final HttpServletRequest request) {
        try {
            final JsonNode root = mapper.readTree(request.getReader());
            if (root == null || root.isMissingNode()) {
                return null;
            }
            if (root.has("dataSet") && root.get("dataSet").isTextual()) {
                return root.get("dataSet").asText();
            }
            return null;
        } catch (IOException ex) {
            LOG.debug("could not sniff dataSet from body: {}", ex.getMessage());
            return null;
        }
    }

    private boolean reject(final HttpServletResponse response, final CaptureWorkflow w,
                             final HttpServletRequest request, final String code,
                             final String message) throws IOException {
        try {
            audit.append(new AuditEvent(
                    code,
                    AuditEvent.Outcome.DENIED,
                    null, null,
                    request.getRemoteAddr(),
                    request.getHeader("User-Agent"),
                    Map.of("workflowId", w.workflowId().toString(),
                            "dataSetId", w.boundMetadataId())),
                    Instant.now(clock));
        } catch (RuntimeException ex) {
            LOG.warn("audit append failed for {}: {}", code, ex.getMessage());
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("message", message);
        body.put("workflowId", w.workflowId().toString());
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(mapper.writeValueAsString(body));
        return false;
    }
}
