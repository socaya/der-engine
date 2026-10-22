package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Optional;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class SessionCookieAuthenticationFilterTest {

    private static final SecurityProperties PROPS = new SecurityProperties(
            new SecurityProperties.Session(Duration.ofHours(1), "DER_SESSION", false, "Strict", "s"),
            new SecurityProperties.SignIn(10, 5),
            new SecurityProperties.Bootstrap("", ""));

    @Test
    void bindsPrincipalWhenValidatorResolvesCookie() throws Exception {
        SecurityContextHolder.clearContext();
        final SessionValidationService validator = mock(SessionValidationService.class);
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setCookies(new Cookie("DER_SESSION", "raw"));
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        final FilterChain chain = mock(FilterChain.class);
        final EdgeUser alice = new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), Instant.now(), Instant.now());
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), alice.userId(), "h", Instant.now(), Instant.now(),
                Instant.now().plusSeconds(60), null, null, null);
        when(validator.resolve("raw")).thenReturn(Optional.of(new SessionValidationService.Resolved(alice, s)));

        new SessionCookieAuthenticationFilter(validator, PROPS).doFilter(req, resp, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication())
                .isInstanceOf(EdgeUserPrincipal.class);
        verify(chain).doFilter(req, resp);
        SecurityContextHolder.clearContext();
    }

    @Test
    void noCookieLeavesContextEmpty() throws Exception {
        SecurityContextHolder.clearContext();
        final SessionValidationService validator = mock(SessionValidationService.class);
        final MockHttpServletRequest req = new MockHttpServletRequest();
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        final FilterChain chain = mock(FilterChain.class);

        new SessionCookieAuthenticationFilter(validator, PROPS).doFilter(req, resp, chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(req, resp);
    }

    @Test
    void blankCookieValueDoesNotTouchValidator() throws Exception {
        SecurityContextHolder.clearContext();
        final SessionValidationService validator = mock(SessionValidationService.class);
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setCookies(new Cookie("DER_SESSION", ""));
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        final FilterChain chain = mock(FilterChain.class);

        new SessionCookieAuthenticationFilter(validator, PROPS).doFilter(req, resp, chain);
        verify(validator, org.mockito.Mockito.never()).resolve(any());
    }

    @Test
    void nullCookieValueDoesNotTouchValidator() throws Exception {
        SecurityContextHolder.clearContext();
        final SessionValidationService validator = mock(SessionValidationService.class);
        final MockHttpServletRequest req = new MockHttpServletRequest();
        final Cookie c = new Cookie("DER_SESSION", "placeholder");
        c.setValue(null);
        req.setCookies(c);
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        final FilterChain chain = mock(FilterChain.class);

        new SessionCookieAuthenticationFilter(validator, PROPS).doFilter(req, resp, chain);
        verify(validator, org.mockito.Mockito.never()).resolve(any());
    }

    @Test
    void cookiesWithoutDerSessionAreIgnored() throws Exception {
        SecurityContextHolder.clearContext();
        final SessionValidationService validator = mock(SessionValidationService.class);
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setCookies(new Cookie("OTHER", "x"));
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        final FilterChain chain = mock(FilterChain.class);

        new SessionCookieAuthenticationFilter(validator, PROPS).doFilter(req, resp, chain);
        verify(validator, org.mockito.Mockito.never()).resolve(any());
    }

    @Test
    void preAuthenticatedContextIsNotOverridden() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("x", null));
        final SessionValidationService validator = mock(SessionValidationService.class);
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setCookies(new Cookie("DER_SESSION", "raw"));
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        final FilterChain chain = mock(FilterChain.class);

        new SessionCookieAuthenticationFilter(validator, PROPS).doFilter(req, resp, chain);
        verify(validator, org.mockito.Mockito.never()).resolve(any());
        SecurityContextHolder.clearContext();
    }

    @Test
    void validatorReturningEmptyLeavesContextEmpty() throws Exception {
        SecurityContextHolder.clearContext();
        final SessionValidationService validator = mock(SessionValidationService.class);
        when(validator.resolve("raw")).thenReturn(Optional.empty());
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setCookies(new Cookie("DER_SESSION", "raw"));
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        final FilterChain chain = mock(FilterChain.class);

        new SessionCookieAuthenticationFilter(validator, PROPS).doFilter(req, resp, chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
