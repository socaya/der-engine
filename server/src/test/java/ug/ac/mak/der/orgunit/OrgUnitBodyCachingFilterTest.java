package ug.ac.mak.der.orgunit;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;

import jakarta.servlet.ServletInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class OrgUnitBodyCachingFilterTest {

    @Test
    void wrapsGuardedPost() throws Exception {
        final OrgUnitBodyCachingFilter filter = new OrgUnitBodyCachingFilter();
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod("POST");
        req.setRequestURI("/api/dataValueSets");
        req.setContent("{\"orgUnit\":\"ou-1\"}".getBytes());
        final MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, new MockHttpServletResponse(), chain);
        final jakarta.servlet.ServletRequest wrapped = chain.getRequest();
        assertThat(wrapped).isInstanceOf(OrgUnitBodyCachingFilter.CachedBodyRequest.class);
        // body replayable
        final OrgUnitBodyCachingFilter.CachedBodyRequest cached =
                (OrgUnitBodyCachingFilter.CachedBodyRequest) wrapped;
        try (ServletInputStream in = cached.getInputStream()) {
            assertThat(new String(in.readAllBytes())).contains("ou-1");
        }
        assertThat(cached.getReader().readLine()).contains("ou-1");
        assertThat(cached.cachedBody()).isNotNull();
    }

    @Test
    void doesNotWrapGet() throws Exception {
        final OrgUnitBodyCachingFilter filter = new OrgUnitBodyCachingFilter();
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod("GET");
        req.setRequestURI("/api/dataValueSets");
        final MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, new MockHttpServletResponse(), chain);
        assertThat(chain.getRequest()).isSameAs(req);
    }

    @Test
    void doesNotWrapNonGuardedPost() throws Exception {
        final OrgUnitBodyCachingFilter filter = new OrgUnitBodyCachingFilter();
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod("POST");
        req.setRequestURI("/edge-api/v1/auth/sign-in");
        req.setContent("{}".getBytes());
        final MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, new MockHttpServletResponse(), chain);
        assertThat(chain.getRequest()).isSameAs(req);
    }

    @Test
    void cachedReaderUsesConfiguredCharset() throws Exception {
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod("POST");
        req.setRequestURI("/api/dataValueSets");
        req.setContent("{\"ascii\":\"ok\"}".getBytes());
        req.setCharacterEncoding("UTF-8");
        final MockFilterChain chain = new MockFilterChain();
        new OrgUnitBodyCachingFilter().doFilter(req, new MockHttpServletResponse(), chain);
        final OrgUnitBodyCachingFilter.CachedBodyRequest cached =
                (OrgUnitBodyCachingFilter.CachedBodyRequest) chain.getRequest();
        assertThat(cached.getReader().readLine()).isEqualTo("{\"ascii\":\"ok\"}");
    }

    @Test
    void inputStreamIsFinishedAfterRead() throws Exception {
        final MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod("POST");
        req.setRequestURI("/api/events");
        req.setContent("x".getBytes());
        final MockFilterChain chain = new MockFilterChain();
        new OrgUnitBodyCachingFilter().doFilter(req, new MockHttpServletResponse(), chain);
        final OrgUnitBodyCachingFilter.CachedBodyRequest cached =
                (OrgUnitBodyCachingFilter.CachedBodyRequest) chain.getRequest();
        try (ServletInputStream in = cached.getInputStream()) {
            assertThat(in.isReady()).isTrue();
            assertThat(in.isFinished()).isFalse();
            in.readAllBytes();
            assertThat(in.isFinished()).isTrue();
            org.junit.jupiter.api.Assertions.assertThrows(UnsupportedOperationException.class,
                    () -> in.setReadListener(null));
        }
        // Confirm that reads do not disturb the cached payload.
        assertThat(new ByteArrayInputStream(cached.cachedBody()).readAllBytes())
                .isEqualTo("x".getBytes());
    }
}
