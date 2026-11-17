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

    /** DHIS2 clients commonly append {@code .json} as a content-type
     *  override hint (e.g. {@code /api/44/programRules.json}). Our
     *  controllers rely on Spring content-negotiation + the {@code
     *  Accept} header, so the suffix is pure sugar — strip it here. */
    private static final Pattern JSON_SUFFIX =
            Pattern.compile("^(/api/.+)\\.json$");

    /** Pre-React DHIS2 apps (adex-flow, legacy Web API consumers)
     *  were built with their own {@code /dhis-web-&lt;appKey&gt;/}
     *  as the fetch base path. On central they rely on a Tomcat
     *  filter that rewrites {@code /dhis-web-&lt;app&gt;/api/...}
     *  back to {@code /api/...}. DER mirrors that rewrite so
     *  legacy apps work unmodified. */
    private static final Pattern APP_BASE_PREFIX =
            Pattern.compile("^/dhis-web-[a-zA-Z0-9-]+/api/(.*)$");

    @Override
    protected void doFilterInternal(final HttpServletRequest request,
                                        final HttpServletResponse response,
                                        final FilterChain chain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        boolean rewrote = false;
        // 1. Strip pre-React DHIS2 apps' own base-path prefix on
        //    api/* calls — adex-flow and other Web Component apps
        //    were built with /dhis-web-<appKey>/ as their fetch
        //    base. Applied first so the version+suffix passes
        //    below see the canonical /api/* shape.
        final Matcher appBase = APP_BASE_PREFIX.matcher(uri);
        if (appBase.matches()) {
            uri = "/api/" + appBase.group(1);
            rewrote = true;
        }
        // 2. Strip the DHIS2 API version prefix.
        final Matcher ver = VERSION_PREFIX.matcher(uri);
        if (ver.matches()) {
            uri = "/api/" + ver.group(2);
            rewrote = true;
        }
        // 3. Strip a trailing .json content-type sugar suffix. Applied
        //    AFTER the version strip so the combined form works:
        //    `/api/44/programRules.json` → `/api/programRules`.
        final Matcher sfx = JSON_SUFFIX.matcher(uri);
        if (sfx.matches()) {
            uri = sfx.group(1);
            rewrote = true;
        }
        if (!rewrote) {
            chain.doFilter(request, response);
            return;
        }
        final String forward = uri;
        LOG.debug("DHIS2 app-runtime request rewrite: {} -> {}",
                request.getRequestURI(), forward);
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
