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
    void nonGuardedPathPasses() throws Exception {
        // Previously named `nonEdgeApiPathPasses` — that was pre-
        // NFR-30 when only /edge-api/* was gated. NFR-30 expands
        // the gate to cover the DHIS2 write surfaces too
        // (/api/dataValueSets, /api/events, /api/tracker), so the
        // "unguarded path" probe needs a prefix neither tree owns.
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.REJECT));
        final MockHttpServletRequest req = new MockHttpServletRequest(
                "POST", "/favicon.ico");
        assertThat(i.preHandle(req, new MockHttpServletResponse(), new Object())).isTrue();
    }

    @Test
    void dhis2WriteSurfacesAreGatedUnderReject() throws Exception {
        // NFR-30 — /api/dataValueSets / /api/events / /api/tracker
        // must 507 when storage is below the reject threshold.
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.REJECT));
        for (final String path : new String[]{
                "/api/dataValueSets", "/api/events", "/api/tracker" }) {
            final MockHttpServletRequest req = new MockHttpServletRequest(
                    "POST", path);
            final MockHttpServletResponse resp = new MockHttpServletResponse();
            assertThat(i.preHandle(req, resp, new Object()))
                    .as("%s must be blocked when storage is at REJECT", path)
                    .isFalse();
            assertThat(resp.getStatus()).isEqualTo(507);
            assertThat(resp.getContentAsString()).contains("STORAGE_FULL_REJECT");
        }
    }

    @Test
    void dhis2SettingsWritesAreExemptEvenUnderReject() throws Exception {
        // /api/userSettings/<key> and /api/systemSettings/<key>
        // are tiny kv writes that an operator may need to flip
        // while the storage alarm is active (e.g. toggling a
        // pref). Keep them exempt — they can't meaningfully
        // exhaust storage.
        final StorageAdmissionInterceptor i =
                new StorageAdmissionInterceptor(probeWith(StorageHealthProbe.Status.REJECT));
        for (final String path : new String[]{
                "/api/userSettings/keyUiLocale",
                "/api/systemSettings/keyAnalysisDisplayProperty" }) {
            final MockHttpServletRequest req = new MockHttpServletRequest(
                    "POST", path);
            assertThat(i.preHandle(req, new MockHttpServletResponse(), new Object()))
                    .as("%s must stay reachable under REJECT", path)
                    .isTrue();
        }
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
