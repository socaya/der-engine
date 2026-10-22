package ug.ac.mak.der.security;

import java.io.IOException;
import java.util.Objects;
import java.util.Set;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * ADR-0017 D4: rejects plain-HTTP requests when
 * {@code der.security.require-tls=true}. Loopback is exempt so the
 * pilot smoke-test + health-probe cron continue to work.
 */
@Component
public class TlsEnforcementFilter extends OncePerRequestFilter {

    private static final Set<String> LOOPBACK = Set.of("127.0.0.1", "::1", "0:0:0:0:0:0:0:1", "localhost");

    private final boolean require;
    private final boolean loopbackExempt;
    private final ObjectMapper mapper;

    public TlsEnforcementFilter(
            @Value("${der.security.require-tls:false}") final boolean require,
            @Value("${der.security.tls.loopback-exempt:true}") final boolean loopbackExempt,
            final ObjectMapper mapper) {
        this.require = require;
        this.loopbackExempt = loopbackExempt;
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    protected void doFilterInternal(final HttpServletRequest request,
                                      final HttpServletResponse response,
                                      final FilterChain chain)
            throws ServletException, IOException {
        if (!require || isHttps(request) || (loopbackExempt && isLoopback(request))) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpStatus.UPGRADE_REQUIRED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(mapper.writeValueAsString(java.util.Map.of(
                "code", "TLS_REQUIRED",
                "message", "DER requires HTTPS. Terminate TLS at nginx or the loadbalancer.")));
    }

    static boolean isHttps(final HttpServletRequest request) {
        if ("https".equalsIgnoreCase(request.getScheme())) {
            return true;
        }
        final String fwd = request.getHeader("X-Forwarded-Proto");
        return "https".equalsIgnoreCase(fwd);
    }

    static boolean isLoopback(final HttpServletRequest request) {
        final String remote = request.getRemoteAddr();
        if (remote == null) {
            return false;
        }
        return LOOPBACK.contains(remote);
    }
}
