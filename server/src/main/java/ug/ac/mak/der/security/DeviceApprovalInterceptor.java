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
    /** Relay header set by {@code JournalReplicator} on the receiver
     *  side when it POSTs a journal entry on behalf of a source
     *  device. When present the request is treated as an authenticated
     *  relay: both the device header (receiver) AND the on-behalf-of
     *  header (source) must point at APPROVED devices before the
     *  request is admitted. Attribution-aware controllers prefer the
     *  on-behalf-of value for journal writes so the original device's
     *  identity is preserved end-to-end. */
    public static final String ON_BEHALF_HEADER = "X-DER-On-Behalf-Of";

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
        // ADMIN bypass. Admins operate from the admin UI (same
        // origin, carries session cookie) to verify installed apps;
        // they don't carry a device ID because the admin console
        // isn't a "device" in the ADR-0019 sense. Without this
        // bypass, opening /dhis-web-<key>/ from the admin catalogue
        // returns 403 DEVICE_HEADER_REQUIRED and the operator has
        // no path to inspect what they just installed. Audit still
        // records the serve via DER_APP_OPENED in AppStaticHandler;
        // nothing is silently relaxed.
        if (isAuthenticatedAdmin()) {
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
        // Relay request: receiver is the approved device above;
        // on-behalf-of must also be an approved device. Audit the
        // relay so a journal row attributed to the source device can
        // be traced back to the relay that actually posted it.
        final String onBehalfOf = request.getHeader(ON_BEHALF_HEADER);
        if (onBehalfOf != null && !onBehalfOf.isBlank()) {
            final String sourceDevice = onBehalfOf.trim();
            final Optional<NetworkClient> source =
                    networkRepo.findClient(sourceDevice);
            if (source.isEmpty()
                    || source.get().trust() == null
                    || source.get().trust() != NetworkEntities.ClientTrust.APPROVED) {
                final String trustName = source
                        .map(NetworkClient::trust)
                        .map(Enum::name)
                        .orElse("UNENROLLED");
                return reject(response, request, "ON_BEHALF_NOT_APPROVED",
                        "on-behalf device " + sourceDevice + " trust=" + trustName);
            }
            // Record the relay so operators can trace an attributed
            // journal row back to the device that actually POSTed it.
            // Non-blocking — if audit append fails we still admit the
            // request (the relay is still legitimate).
            try {
                audit.append(new AuditEvent(
                        "P2P_RELAY_ADMITTED",
                        AuditEvent.Outcome.SUCCESS,
                        null, null,
                        request.getRemoteAddr(),
                        request.getHeader("User-Agent"),
                        Map.of(
                                "path", request.getRequestURI(),
                                "method", request.getMethod(),
                                "relayDevice", rawHeader.trim(),
                                "sourceDevice", sourceDevice)),
                        Instant.now(clock));
            } catch (final RuntimeException ex) {
                LOG.debug("audit append for P2P_RELAY_ADMITTED failed: {}",
                        ex.getMessage());
            }
        }
        return true;
    }

    /**
     * True when the current {@link org.springframework.security.core.SecurityContext}
     * carries a session principal whose roles include ADMIN. Called
     * once per guarded request; cheap because SecurityContextHolder
     * is a ThreadLocal.
     */
    private static boolean isAuthenticatedAdmin() {
        final var auth = org.springframework.security.core.context
                .SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return false;
        }
        return principal.user().roles().contains(EdgeRole.ADMIN);
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
