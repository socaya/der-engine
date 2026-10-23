package ug.ac.mak.der.ops;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.PrintWriter;
import java.io.StringWriter;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class StorageAdmissionInterceptorTest {

    private static StorageHealthProbe probeWith(final StorageHealthProbe.Status status) {
        final StorageHealthProbe probe = mock(StorageHealthProbe.class);
        when(probe.sample()).thenReturn(new StorageHealthProbe.Snapshot(
                "/x", 10L, 100L, 50L, 20L, status));
        return probe;
    }

    @Test
    void passesWhenStorageOk() throws Exception {
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.OK));
        final MockHttpServletRequest req = new MockHttpServletRequest("POST",
                "/edge-api/v1/aggregate/dataValueSets");
        final MockHttpServletResponse res = new MockHttpServletResponse();
        assertThat(i.preHandle(req, res, new Object())).isTrue();
    }

    @Test
    void readsAlwaysPass() throws Exception {
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.REJECT));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET",
                "/edge-api/v1/system/storage");
        assertThat(i.preHandle(req, new MockHttpServletResponse(), new Object())).isTrue();
    }

    @Test
    void authPathBypassesEvenOnReject() throws Exception {
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.REJECT));
        final MockHttpServletRequest req = new MockHttpServletRequest("POST",
                "/edge-api/v1/auth/login");
        assertThat(i.preHandle(req, new MockHttpServletResponse(), new Object())).isTrue();
    }

    @Test
    void adminOpsBypassesEvenOnReject() throws Exception {
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.REJECT));
        final MockHttpServletRequest req = new MockHttpServletRequest("POST",
                "/edge-api/v1/admin/ops/journal/purge");
        assertThat(i.preHandle(req, new MockHttpServletResponse(), new Object())).isTrue();
    }

    @Test
    void rejectsWriteWhenStorageReject() throws Exception {
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.REJECT));
        final MockHttpServletRequest req = new MockHttpServletRequest("POST",
                "/edge-api/v1/aggregate/dataValueSets");
        final MockHttpServletResponse res = new MockHttpServletResponse();
        assertThat(i.preHandle(req, res, new Object())).isFalse();
        assertThat(res.getStatus()).isEqualTo(507);
        assertThat(res.getContentAsString()).contains("STORAGE_FULL_REJECT");
    }

    @Test
    void nonEdgeApiPathPasses() throws Exception {
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.REJECT));
        final MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/other");
        assertThat(i.preHandle(req, new MockHttpServletResponse(), new Object())).isTrue();
    }

    @Test
    void warnDoesNotBlock() throws Exception {
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.WARN));
        final MockHttpServletRequest req = new MockHttpServletRequest("POST",
                "/edge-api/v1/aggregate/dataValueSets");
        assertThat(i.preHandle(req, new MockHttpServletResponse(), new Object())).isTrue();
    }
}
