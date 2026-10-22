package ug.ac.mak.der.orgunit;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Spring MVC {@link HandlerInterceptor} that enforces ADR-0015.
 *
 * <p>Rejects writeable requests whose payload references an orgUnit
 * outside the bound sub-tree. Reads unaffected. Pre-flight for both
 * {@code /api/**} and {@code /edge-api/v1/dataValueSets} and tracker
 * endpoints.</p>
 */
@Component
@ConditionalOnBean(OrgUnitBindingService.class)
public class OrgUnitScopeInterceptor implements HandlerInterceptor {

    private static final Logger LOG = LoggerFactory.getLogger(OrgUnitScopeInterceptor.class);

    private final OrgUnitBindingService service;
    private final ObjectMapper mapper;
    private final int maxDepth;

    public OrgUnitScopeInterceptor(final OrgUnitBindingService service,
                                     final ObjectMapper mapper,
                                     @Value("${der.security.org-unit.max-depth:3}")
                                     final int maxDepth) {
        this.service = Objects.requireNonNull(service, "service");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.maxDepth = Math.max(0, maxDepth);
    }

    @Override
    public boolean preHandle(final HttpServletRequest request,
                              final HttpServletResponse response,
                              final Object handler) throws IOException {
        final String method = request.getMethod();
        if (!"POST".equals(method) && !"PUT".equals(method) && !"PATCH".equals(method)) {
            return true;
        }
        final String path = request.getRequestURI();
        if (!shouldGuard(path)) {
            return true;
        }
        final EdgeOrgUnitBinding binding = service.current();
        if (!binding.isBound()) {
            return reject(response, HttpStatus.PRECONDITION_FAILED, "OU_NOT_BOUND",
                    "edge is not bound to an orgUnit; admin must call "
                            + "POST /edge-api/v1/system/org-unit", null, null);
        }
        final String candidateOrgUnit = sniffOrgUnit(request);
        if (candidateOrgUnit == null) {
            // No orgUnit in the payload — the service layer will reject
            // separately; nothing to enforce here.
            return true;
        }
        if (!service.isInScope(candidateOrgUnit, maxDepth)) {
            return reject(response, HttpStatus.FORBIDDEN, "OU_OUT_OF_SCOPE",
                    "orgUnit " + candidateOrgUnit
                            + " is not under the bound sub-tree " + binding.orgUnitPath(),
                    binding.orgUnitId(), binding.orgUnitPath());
        }
        return true;
    }

    static boolean shouldGuard(final String path) {
        if (path == null) {
            return false;
        }
        return path.equals("/api/dataValueSets")
                || path.equals("/api/events")
                || path.startsWith("/api/tracker");
    }

    private String sniffOrgUnit(final HttpServletRequest request) {
        try {
            final JsonNode root = mapper.readTree(request.getReader());
            if (root == null || root.isMissingNode()) {
                return null;
            }
            if (root.has("orgUnit") && root.get("orgUnit").isTextual()) {
                return root.get("orgUnit").asText();
            }
            final JsonNode events = root.get("events");
            if (events != null && events.isArray() && events.size() > 0
                    && events.get(0).has("orgUnit")) {
                return events.get(0).get("orgUnit").asText();
            }
            final JsonNode dvs = root.get("dataValues");
            if (dvs != null && dvs.isArray() && dvs.size() > 0 && dvs.get(0).has("orgUnit")) {
                return dvs.get(0).get("orgUnit").asText();
            }
            return null;
        } catch (IOException ex) {
            LOG.debug("could not sniff orgUnit from body: {}", ex.getMessage());
            return null;
        }
    }

    private boolean reject(final HttpServletResponse response, final HttpStatus status,
                             final String code, final String message,
                             final String boundOrgUnitId, final String boundOrgUnitPath)
            throws IOException {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("message", message);
        if (boundOrgUnitId != null) {
            body.put("boundOrgUnitId", boundOrgUnitId);
            body.put("boundOrgUnitPath", boundOrgUnitPath);
        }
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(mapper.writeValueAsString(body));
        return false;
    }
}
