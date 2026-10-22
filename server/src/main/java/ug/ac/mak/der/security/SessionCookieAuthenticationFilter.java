package ug.ac.mak.der.security;

import java.io.IOException;
import java.util.Objects;
import java.util.Optional;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Resolve the {@code DER_SESSION} cookie into a {@link EdgeUserPrincipal} and
 * bind it to the Spring Security context for the duration of the request.
 *
 * <p>Does not reject anonymous requests on its own — authorisation rules in
 * {@link SecurityConfig#securityFilterChain} decide which paths require a
 * principal.</p>
 */
public final class SessionCookieAuthenticationFilter extends OncePerRequestFilter {

    private final SessionValidationService validator;
    private final SecurityProperties props;

    public SessionCookieAuthenticationFilter(final SessionValidationService validator,
                                             final SecurityProperties props) {
        this.validator = Objects.requireNonNull(validator, "validator");
        this.props = Objects.requireNonNull(props, "props");
    }

    @Override
    protected void doFilterInternal(final HttpServletRequest request,
                                    final HttpServletResponse response,
                                    final FilterChain chain) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            final Optional<String> cookie = readCookie(request);
            if (cookie.isPresent()) {
                validator.resolve(cookie.get()).ifPresent(resolved -> {
                    final EdgeUserPrincipal principal = new EdgeUserPrincipal(resolved.user(), resolved.session());
                    SecurityContextHolder.getContext().setAuthentication(principal);
                });
            }
        }
        chain.doFilter(request, response);
    }

    private Optional<String> readCookie(final HttpServletRequest request) {
        final Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        final String name = props.session().cookieName();
        for (final Cookie c : cookies) {
            if (name.equals(c.getName())) {
                final String v = c.getValue();
                return v == null || v.isBlank() ? Optional.empty() : Optional.of(v);
            }
        }
        return Optional.empty();
    }
}
