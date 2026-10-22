package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class TlsEnforcementFilterTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private MockHttpServletRequest req(final String scheme, final String fwdProto,
                                          final String remote) {
        final MockHttpServletRequest r = new MockHttpServletRequest();
        r.setScheme(scheme);
        if (fwdProto != null) {
            r.addHeader("X-Forwarded-Proto", fwdProto);
        }
        r.setRemoteAddr(remote);
        return r;
    }

    @Test
    void disabledLetsEverythingThrough() throws Exception {
        final FilterChain chain = mock(FilterChain.class);
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        new TlsEnforcementFilter(false, true, mapper)
                .doFilter(req("http", null, "10.0.0.1"), resp, chain);
        verify(chain).doFilter(any(), any());
    }

    private static <T> T any() {
        return org.mockito.ArgumentMatchers.any();
    }

    @Test
    void rejectsHttpWithUpgradeRequired() throws Exception {
        final FilterChain chain = mock(FilterChain.class);
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        new TlsEnforcementFilter(true, true, mapper)
                .doFilter(req("http", null, "10.0.0.1"), resp, chain);
        assertThat(resp.getStatus()).isEqualTo(426);
        assertThat(resp.getContentAsString()).contains("TLS_REQUIRED");
        verifyNoInteractions(chain);
    }

    @Test
    void httpsSchemePasses() throws Exception {
        final FilterChain chain = mock(FilterChain.class);
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        new TlsEnforcementFilter(true, true, mapper)
                .doFilter(req("https", null, "10.0.0.1"), resp, chain);
        verify(chain).doFilter(any(), any());
    }

    @Test
    void forwardedProtoHttpsPasses() throws Exception {
        final FilterChain chain = mock(FilterChain.class);
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        new TlsEnforcementFilter(true, true, mapper)
                .doFilter(req("http", "https", "10.0.0.1"), resp, chain);
        verify(chain).doFilter(any(), any());
    }

    @Test
    void loopbackIsExemptByDefault() throws Exception {
        final FilterChain chain = mock(FilterChain.class);
        new TlsEnforcementFilter(true, true, mapper)
                .doFilter(req("http", null, "127.0.0.1"), new MockHttpServletResponse(), chain);
        verify(chain).doFilter(any(), any());
    }

    @Test
    void loopbackExemptionDisableable() throws Exception {
        final FilterChain chain = mock(FilterChain.class);
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        new TlsEnforcementFilter(true, false, mapper)
                .doFilter(req("http", null, "127.0.0.1"), resp, chain);
        assertThat(resp.getStatus()).isEqualTo(426);
    }

    @Test
    void nullRemoteIsNotLoopback() {
        final MockHttpServletRequest r = new MockHttpServletRequest();
        r.setRemoteAddr(null);
        assertThat(TlsEnforcementFilter.isLoopback(r)).isFalse();
    }

    @Test
    void ipv6LoopbackRecognised() {
        final MockHttpServletRequest r = new MockHttpServletRequest();
        r.setRemoteAddr("::1");
        assertThat(TlsEnforcementFilter.isLoopback(r)).isTrue();
    }
}
