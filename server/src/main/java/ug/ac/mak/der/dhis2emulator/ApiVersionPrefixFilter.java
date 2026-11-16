package ug.ac.mak.der.dhis2emulator;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.servlet.FilterChain;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * DHIS2's {@code @dhis2/app-runtime} library prefixes every API
 * call with the DHIS2 minor version it was built against:
 * {@code /api/40/userSettings}, {@code /api/v44/me}, etc. DER's
 * emulator controllers are all mapped at {@code /api/<resource>}
 * without a version segment, so every request from a stock DHIS2
 * app bootstrap 404s — which is why eregisters / Capture surface
 * "Failed to fetch user locale (404)" even when the underlying
 * emulator endpoint works.
 *
 * <p>This filter forwards any {@code /api/<n>/<rest>} or
 * {@code /api/v<n>/<rest>} to the unversioned mapping {@code
 * /api/<rest>}. {@code <n>} is 2-3 digits so this can't collide
 * with real resource names (DHIS2 resources are all alpha /
 * kebab-case). The forward is transparent — downstream filters +
 * controllers see the stripped URI as if the caller had asked
 * for it directly.</p>
 *
 * <p>Deliberately returns an unauthenticated 404 for malformed
 * version segments by falling through to the chain — the real
 * {@code /api/<rest>} controller handles the 404 so error
 * surface is uniform.</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 50)
public class ApiVersionPrefixFilter extends OncePerRequestFilter {

    private static final Logger LOG =
            LoggerFactory.getLogger(ApiVersionPrefixFilter.class);

    /** Match `/api/<digits>/<rest>` or `/api/v<digits>/<rest>`.
     *  Digits are 2-3 chars so this never eats a resource name. */
    private static final Pattern VERSION_PREFIX =
            Pattern.compile("^/api/v?(\\d{2,3})/(.*)$");

    @Override
    protected void doFilterInternal(final HttpServletRequest request,
                                        final HttpServletResponse response,
                                        final FilterChain chain)
            throws ServletException, IOException {
        final String uri = request.getRequestURI();
        final Matcher m = VERSION_PREFIX.matcher(uri);
        if (!m.matches()) {
            chain.doFilter(request, response);
            return;
        }
        final String rest = m.group(2);
        final String forward = "/api/" + rest;
        LOG.debug("DHIS2 app-runtime versioned request: {} -> {}",
                uri, forward);
        // Preserve the query string via request.getRequestDispatcher.
        final RequestDispatcher dispatcher = request.getRequestDispatcher(forward);
        if (dispatcher == null) {
            chain.doFilter(request, response);
            return;
        }
        dispatcher.forward(new StrippedUriRequest(request, forward), response);
    }

    /**
     * HttpServletRequestWrapper that reports the stripped URI so
     * downstream @RequestMapping path variables resolve correctly.
     * Spring's RequestMappingHandlerMapping reads getRequestURI()
     * and getServletPath() — both need to match the unversioned
     * mapping.
     */
    private static final class StrippedUriRequest extends HttpServletRequestWrapper {
        private final String uri;

        StrippedUriRequest(final HttpServletRequest req, final String uri) {
            super(req);
            this.uri = uri;
        }

        @Override
        public String getRequestURI() {
            return uri;
        }

        @Override
        public String getServletPath() {
            return uri;
        }
    }
}
