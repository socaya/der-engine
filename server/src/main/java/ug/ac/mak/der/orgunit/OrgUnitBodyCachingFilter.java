package ug.ac.mak.der.orgunit;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Wraps guarded POST/PUT/PATCH requests so both {@link OrgUnitScopeInterceptor}
 * (via {@code getReader()} once) and the downstream controller (via
 * {@code @RequestBody}) can read the body independently. ADR-0015.
 */
@Component
public class OrgUnitBodyCachingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(final HttpServletRequest request,
                                      final HttpServletResponse response,
                                      final FilterChain chain)
            throws ServletException, IOException {
        if (shouldWrap(request)) {
            chain.doFilter(new CachedBodyRequest(request), response);
        } else {
            chain.doFilter(request, response);
        }
    }

    private boolean shouldWrap(final HttpServletRequest request) {
        final String method = request.getMethod();
        if (!"POST".equals(method) && !"PUT".equals(method) && !"PATCH".equals(method)) {
            return false;
        }
        return OrgUnitScopeInterceptor.shouldGuard(request.getRequestURI());
    }

    /** HttpServletRequest wrapper that reads the body once and replays it. */
    static final class CachedBodyRequest extends HttpServletRequestWrapper {

        private final byte[] body;

        CachedBodyRequest(final HttpServletRequest req) throws IOException {
            super(req);
            this.body = req.getInputStream().readAllBytes();
        }

        byte[] cachedBody() {
            return body.clone();
        }

        @Override
        public ServletInputStream getInputStream() {
            final ByteArrayInputStream in = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return in.available() == 0;
                }
                @Override
                public boolean isReady() {
                    return true;
                }
                @Override
                public void setReadListener(final ReadListener listener) {
                    throw new UnsupportedOperationException();
                }
                @Override
                public int read() {
                    return in.read();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            final Charset cs = getCharacterEncoding() == null
                    ? StandardCharsets.UTF_8 : Charset.forName(getCharacterEncoding());
            return new BufferedReader(new InputStreamReader(
                    new ByteArrayInputStream(body), cs));
        }
    }
}
