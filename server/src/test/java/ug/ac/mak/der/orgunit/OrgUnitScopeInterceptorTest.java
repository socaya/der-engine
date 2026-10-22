package ug.ac.mak.der.orgunit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.BufferedReader;
import java.io.StringReader;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

class OrgUnitScopeInterceptorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private OrgUnitScopeInterceptor interceptor(final OrgUnitBindingService svc) {
        return new OrgUnitScopeInterceptor(svc, mapper, 3);
    }

    private HttpServletRequest req(final String method, final String uri, final String body)
            throws Exception {
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getMethod()).thenReturn(method);
        when(req.getRequestURI()).thenReturn(uri);
        when(req.getReader()).thenReturn(new BufferedReader(new StringReader(body)));
        return req;
    }

    @Test
    void getRequestsAlwaysAllowed() throws Exception {
        final OrgUnitBindingService svc = mock(OrgUnitBindingService.class);
        final MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(interceptor(svc).preHandle(req("GET", "/api/dataValueSets", ""),
                response, new Object())).isTrue();
    }

    @Test
    void nonGuardedPathsAllowed() throws Exception {
        final OrgUnitBindingService svc = mock(OrgUnitBindingService.class);
        final MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(interceptor(svc).preHandle(req("POST", "/api/me", "{}"),
                response, new Object())).isTrue();
    }

    @Test
    void unboundRejectsWith412() throws Exception {
        final OrgUnitBindingService svc = mock(OrgUnitBindingService.class);
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.empty());
        final MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(interceptor(svc).preHandle(
                req("POST", "/api/dataValueSets", "{\"orgUnit\":\"ou-1\"}"),
                response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(412);
        assertThat(response.getContentAsString()).contains("OU_NOT_BOUND");
    }

    @Test
    void missingOrgUnitPassesThrough() throws Exception {
        final OrgUnitBindingService svc = mock(OrgUnitBindingService.class);
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "C", "/root/ou-1", UUID.randomUUID()));
        final MockHttpServletResponse response = new MockHttpServletResponse();
        // Body has no orgUnit field — downstream service validates it.
        assertThat(interceptor(svc).preHandle(
                req("POST", "/api/dataValueSets", "{\"dataValues\":[]}"),
                response, new Object())).isTrue();
    }

    @Test
    void outOfScopeRejectsWith403() throws Exception {
        final OrgUnitBindingService svc = mock(OrgUnitBindingService.class);
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "C", "/root/ou-1", UUID.randomUUID()));
        when(svc.isInScope("ou-foreign", 3)).thenReturn(false);
        final MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(interceptor(svc).preHandle(
                req("POST", "/api/dataValueSets", "{\"orgUnit\":\"ou-foreign\"}"),
                response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("OU_OUT_OF_SCOPE");
    }

    @Test
    void inScopePassesThrough() throws Exception {
        final OrgUnitBindingService svc = mock(OrgUnitBindingService.class);
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "C", "/root/ou-1", UUID.randomUUID()));
        when(svc.isInScope("ou-1", 3)).thenReturn(true);
        final MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(interceptor(svc).preHandle(
                req("POST", "/api/dataValueSets", "{\"orgUnit\":\"ou-1\"}"),
                response, new Object())).isTrue();
    }

    @Test
    void sniffsOrgUnitFromEventsArray() throws Exception {
        final OrgUnitBindingService svc = mock(OrgUnitBindingService.class);
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "C", "/root/ou-1", UUID.randomUUID()));
        when(svc.isInScope("evt-ou", 3)).thenReturn(true);
        final MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(interceptor(svc).preHandle(
                req("POST", "/api/events",
                    "{\"events\":[{\"orgUnit\":\"evt-ou\",\"program\":\"p\"}]}"),
                response, new Object())).isTrue();
    }

    @Test
    void sniffsOrgUnitFromDataValuesArray() throws Exception {
        final OrgUnitBindingService svc = mock(OrgUnitBindingService.class);
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "C", "/root/ou-1", UUID.randomUUID()));
        when(svc.isInScope("row-ou", 3)).thenReturn(true);
        final MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(interceptor(svc).preHandle(
                req("POST", "/api/dataValueSets",
                    "{\"dataValues\":[{\"orgUnit\":\"row-ou\",\"value\":\"1\"}]}"),
                response, new Object())).isTrue();
    }

    @Test
    void malformedBodyPassesThrough() throws Exception {
        final OrgUnitBindingService svc = mock(OrgUnitBindingService.class);
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "C", "/root/ou-1", UUID.randomUUID()));
        final MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(interceptor(svc).preHandle(
                req("POST", "/api/dataValueSets", "{not-json"),
                response, new Object())).isTrue();
    }

    @Test
    void shouldGuardCoversExpectedPaths() {
        assertThat(OrgUnitScopeInterceptor.shouldGuard("/api/dataValueSets")).isTrue();
        assertThat(OrgUnitScopeInterceptor.shouldGuard("/api/events")).isTrue();
        assertThat(OrgUnitScopeInterceptor.shouldGuard("/api/tracker")).isTrue();
        assertThat(OrgUnitScopeInterceptor.shouldGuard("/api/tracker/events")).isTrue();
        assertThat(OrgUnitScopeInterceptor.shouldGuard("/api/me")).isFalse();
        assertThat(OrgUnitScopeInterceptor.shouldGuard("/edge-api/v1/auth/sign-in")).isFalse();
        assertThat(OrgUnitScopeInterceptor.shouldGuard(null)).isFalse();
    }
}
