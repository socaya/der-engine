package ug.ac.mak.der.security;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

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

import ug.ac.mak.der.network.NetworkEntities;
import ug.ac.mak.der.network.NetworkEntities.NetworkClient;
import ug.ac.mak.der.network.NetworkRepository;

/**
 * ADR-0019 slice B — enforces device-trust approval on client-app
 * bundle fetch and workflow-bound writes. When the
 * {@code der.security.device-approval.required} setting is
 * {@code true} (default), requests that carry an
 * {@code X-DER-Device-Id} header are accepted only if the referenced
 * device is {@code APPROVED} in {@code der.network_client}. When the
 * setting is {@code false}, the interceptor is a no-op — slice-A
 * banner posture is preserved for open-pilot scenarios.
 */
@Component
@ConditionalOnBean(NetworkRepository.class)
public class DeviceApprovalInterceptor implements HandlerInterceptor {

    private static final Logger LOG =
            LoggerFactory.getLogger(DeviceApprovalInterceptor.class);
    static final String DEVICE_HEADER = "X-DER-Device-Id";

    private final NetworkRepository networkRepo;
    private final DeviceApprovalPolicy policy;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    public DeviceApprovalInterceptor(final NetworkRepository networkRepo,
                                        final DeviceApprovalPolicy policy,
                                        final SecurityAuditRepository audit,
                                        final ObjectMapper mapper,
                                        final Clock clock) {
        this.networkRepo = Objects.requireNonNull(networkRepo, "networkRepo");
        this.policy = Objects.requireNonNull(policy, "policy");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Override
    public boolean preHandle(final HttpServletRequest request,
                                final HttpServletResponse response,
                                final Object handler) throws IOException {
        if (!policy.required()) {
            return true;
        }
        if (isExempt(request.getRequestURI())) {
            return true;
        }
        final String rawHeader = request.getHeader(DEVICE_HEADER);
        if (rawHeader == null || rawHeader.isBlank()) {
            return reject(response, request, "DEVICE_HEADER_REQUIRED",
                    "X-DER-Device-Id header is required when "
                            + "der.security.device-approval.required=true");
        }
        final Optional<NetworkClient> client =
                networkRepo.findClient(rawHeader.trim());
        if (client.isEmpty()
                || client.get().trust() == null
                || client.get().trust() != NetworkEntities.ClientTrust.APPROVED) {
            final String trustName = client
                    .map(NetworkClient::trust)
                    .map(Enum::name)
                    .orElse("UNENROLLED");
            return reject(response, request, "DEVICE_NOT_APPROVED",
                    "device " + rawHeader.trim() + " trust=" + trustName);
        }
        return true;
    }

    /** Endpoints that must stay reachable regardless of trust so an
     *  unapproved device can discover enrolment affordances and the
     *  admin UI can bootstrap. */
    static boolean isExempt(final String path) {
        if (path == null) {
            return true;
        }
        return path.startsWith("/edge-api/v1/auth/")
                || path.startsWith("/edge-api/v1/apps/signing-key")
                || path.startsWith("/edge-api/v1/devices/enrol")
                || path.startsWith("/edge-api/v1/system/")
                || path.startsWith("/api/system/")
                || path.equals("/api/me");
    }

    private boolean reject(final HttpServletResponse response,
                              final HttpServletRequest request,
                              final String code,
                              final String message) throws IOException {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("message", message);
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(mapper.writeValueAsString(body));
        try {
            audit.append(new AuditEvent(
                    "DEVICE_APPROVAL_DENIED",
                    AuditEvent.Outcome.DENIED,
                    null, null,
                    request.getRemoteAddr(),
                    request.getHeader("User-Agent"),
                    Map.of(
                            "path", request.getRequestURI(),
                            "method", request.getMethod(),
                            "code", code,
                            "reason", message)),
                    Instant.now(clock));
        } catch (RuntimeException ex) {
            LOG.debug("audit write failed: {}", ex.getMessage());
        }
        return false;
    }
}
