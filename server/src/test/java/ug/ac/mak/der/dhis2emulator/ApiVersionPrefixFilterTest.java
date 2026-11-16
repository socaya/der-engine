package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ApiVersionPrefixFilterTest {

    private final ApiVersionPrefixFilter filter = new ApiVersionPrefixFilter();

    @Test
    void stripsBareVersionPrefix() throws Exception {
        final var req = mock(HttpServletRequest.class);
        final var dispatcher = mock(RequestDispatcher.class);
        when(req.getRequestURI()).thenReturn("/api/44/userSettings");
        when(req.getRequestDispatcher("/api/userSettings")).thenReturn(dispatcher);
        final var resp = mock(HttpServletResponse.class);
        final var chain = mock(FilterChain.class);
        filter.doFilterInternal(req, resp, chain);
        verify(dispatcher).forward(any(HttpServletRequest.class),
                any(HttpServletResponse.class));
        verify(chain, never()).doFilter(any(HttpServletRequest.class),
                any(HttpServletResponse.class));
    }

    @Test
    void stripsVPrefixedVersion() throws Exception {
        final var req = mock(HttpServletRequest.class);
        final var dispatcher = mock(RequestDispatcher.class);
        when(req.getRequestURI()).thenReturn("/api/v41/me/authorization");
        when(req.getRequestDispatcher("/api/me/authorization"))
                .thenReturn(dispatcher);
        filter.doFilterInternal(req, mock(HttpServletResponse.class),
                mock(FilterChain.class));
        final ArgumentCaptor<HttpServletRequest> wrapped =
                ArgumentCaptor.forClass(HttpServletRequest.class);
        verify(dispatcher).forward(wrapped.capture(),
                any(HttpServletResponse.class));
        // The wrapped request should report the stripped URI so Spring's
        // @RequestMapping resolution sees /api/me/authorization.
        assertThat(wrapped.getValue().getRequestURI())
                .isEqualTo("/api/me/authorization");
    }

    @Test
    void unversionedPassesThrough() throws Exception {
        final var req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/api/userSettings");
        final var chain = mock(FilterChain.class);
        filter.doFilterInternal(req, mock(HttpServletResponse.class), chain);
        verify(chain).doFilter(org.mockito.ArgumentMatchers.same(req),
                any(HttpServletResponse.class));
    }

    @Test
    void edgeApiPrefixIsNeverRewritten() throws Exception {
        // /edge-api/* must never be touched — only /api/* carries the
        // DHIS2 version-prefix convention.
        final var req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/edge-api/v1/system/health");
        final var chain = mock(FilterChain.class);
        filter.doFilterInternal(req, mock(HttpServletResponse.class), chain);
        verify(chain).doFilter(org.mockito.ArgumentMatchers.same(req),
                any(HttpServletResponse.class));
        verify(req, never()).getRequestDispatcher(any(String.class));
    }

    @Test
    void realResourceNameIsNotMistakenForVersion() throws Exception {
        // A resource name happens to be 2+ chars. The regex only
        // matches digits, so this must pass through untouched.
        final var req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/api/me/authorization");
        final var chain = mock(FilterChain.class);
        filter.doFilterInternal(req, mock(HttpServletResponse.class), chain);
        verify(chain).doFilter(org.mockito.ArgumentMatchers.same(req),
                any(HttpServletResponse.class));
    }

    @Test
    void preservesNestedPathSegments() throws Exception {
        final var req = mock(HttpServletRequest.class);
        final var dispatcher = mock(RequestDispatcher.class);
        when(req.getRequestURI()).thenReturn("/api/44/dataStore/ns/key");
        when(req.getRequestDispatcher("/api/dataStore/ns/key"))
                .thenReturn(dispatcher);
        filter.doFilterInternal(req, mock(HttpServletResponse.class),
                mock(FilterChain.class));
        verify(dispatcher).forward(any(HttpServletRequest.class),
                any(HttpServletResponse.class));
    }
}
