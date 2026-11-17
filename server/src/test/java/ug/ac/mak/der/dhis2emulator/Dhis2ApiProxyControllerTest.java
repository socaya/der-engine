package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import ug.ac.mak.der.dhis2.Dhis2Properties;

class Dhis2ApiProxyControllerTest {

    private static Dhis2Properties props() {
        return new Dhis2Properties(
                new Dhis2Properties.Central("http://localhost:8080/dhis", "u", "p", 1000),
                new Dhis2Properties.Compatibility(
                        "2.40", "2.44", "warn", true, 24, false, "2.44-SNAPSHOT", false));
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse<byte[]> response(final int status, final String body) {
        final HttpResponse<byte[]> r = mock(HttpResponse.class);
        when(r.statusCode()).thenReturn(status);
        when(r.body()).thenReturn(body.getBytes());
        when(r.headers()).thenReturn(java.net.http.HttpHeaders.of(
                Map.of("content-type", List.of("application/json")),
                (a, b) -> true));
        return r;
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<EmulatorMissRepository> missProvider(
            final EmulatorMissRepository repo) {
        final ObjectProvider<EmulatorMissRepository> p = mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(repo);
        return p;
    }

    @Test
    void gracefulEmptyListShapeWhenDisabled() {
        // Previously 404 EMULATOR_NOT_IMPLEMENTED; now returns a
        // DHIS2-shape empty list so apps don't crash on destructure.
        // The miss is still logged for the admin diagnostic.
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), false, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        final String body = new String(res.getBody());
        assertThat(body).contains("\"analytics\":[]")
                .contains("\"pager\":")
                .contains("\"total\":0");
        verify(miss).record(eq("/api/analytics"), eq(""));
    }

    @Test
    void gracefulJobAckOnWriteWhenNotAllowed() {
        // POST under the "not allowed" branch previously 404'd;
        // now returns a DHIS2 ImportSummary job-ack so UI spinners
        // clear instead of surfacing an opaque failure.
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        final String body = new String(res.getBody());
        assertThat(body).contains("\"httpStatus\":\"OK\"")
                .contains("\"responseType\":\"ImportSummary\"")
                .contains("\"imported\":0");
        verify(miss).record(eq("/api/analytics"), eq(""));
    }

    @Test
    void gracefulEmptyListShapeWhenPathNotOnAllowList() {
        // Previously 404 "not on the proxy allow-list"; now returns
        // a DHIS2-shape empty list. Miss still logged.
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        final String body = new String(res.getBody());
        assertThat(body).contains("\"users\":[]")
                .contains("\"pager\":");
        verify(miss).record(eq("/api/users"), eq(""));
    }

    @Test
    void recordsAppOriginFromReferer() {
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        req.addHeader("Referer", "https://der.local/apps/dashboard/index.html");
        p.proxy(req, null);
        verify(miss).record(eq("/api/users"), eq("dashboard"));
    }

    @Test
    void customAllowListOverridesDefault() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse<byte[]> stub = response(200, "{\"ok\":true}");
        when(http.<byte[]>send(any(), any())).thenReturn(stub);
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                http, props(), true, false, "/api/custom", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/custom/stuff");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(res.getBody())).isEqualTo("{\"ok\":true}");
        verify(miss, never()).record(any(), any());
    }

    @Test
    void proxiesSuccessfulRead() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse<byte[]> stub = response(200, "{\"analytics\":[]}");
        when(http.<byte[]>send(any(), any())).thenReturn(stub);
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                http, props(), true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET",
                "/api/analytics");
        req.setQueryString("dimension=dx:x&period=LAST_12_MONTHS");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(res.getBody())).contains("analytics");
        verify(miss, never()).record(any(), any());
    }

    @Test
    void gracefulEmptyListShapeWhenCentralNotConfigured() {
        // No central + proxy enabled → previously 404; now graceful
        // empty-list so apps that happen to call analytics endpoints
        // on an offline-only appliance don't crash.
        final Dhis2Properties noCentral = new Dhis2Properties(
                new Dhis2Properties.Central("", "", "", 1000),
                new Dhis2Properties.Compatibility(
                        "2.40", "2.44", "warn", true, 24, false, "2.44-SNAPSHOT", false));
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), noCentral, true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(res.getBody())).contains("\"analytics\":[]");
        verify(miss).record(eq("/api/analytics"), eq(""));
    }

    @Test
    void allowsWritesWhenConfigured() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse<byte[]> stub = response(201, "{\"created\":true}");
        when(http.<byte[]>send(any(), any())).thenReturn(stub);
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                http, props(), true, true, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("POST",
                "/api/dataStore/ns/key");
        req.setContent("{\"a\":1}".getBytes());
        final ResponseEntity<byte[]> res = p.proxy(req, "{\"a\":1}".getBytes());
        assertThat(res.getStatusCode().value()).isEqualTo(201);
        verify(miss, never()).record(any(), any());
    }

    // ---- FR-04-06 error taxonomy ------------------------------------

    @Test
    void upstreamIoFailureEmitsUpstreamUnavailableEnvelope() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        when(http.<byte[]>send(any(), any())).thenThrow(
                new java.io.IOException("connection reset by peer"));
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                http, props(), true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET",
                "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(502);
        final String body = new String(res.getBody());
        assertThat(body).contains("\"code\":\"UPSTREAM_UNAVAILABLE\"");
        assertThat(body).contains("\"httpStatus\":\"BadGateway\"");
        assertThat(body).contains("\"endpoint\":\"/api/analytics\"");
        // UPSTREAM_UNAVAILABLE is a temporary failure, NOT an emulator
        // miss. Don't record it in the miss log — a central outage
        // would otherwise spam the admin screen.
        verify(miss, never()).record(any(), any());
    }

    @Test
    void upstreamInterruptEmitsUpstreamInterruptedEnvelope() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        when(http.<byte[]>send(any(), any())).thenThrow(
                new InterruptedException("test interrupt"));
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                http, props(), true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET",
                "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(504);
        final String body = new String(res.getBody());
        assertThat(body).contains("\"code\":\"UPSTREAM_INTERRUPTED\"");
        assertThat(body).contains("\"httpStatus\":\"GatewayTimeout\"");
    }

    @Test
    void invalidTargetUriEmitsInvalidRequestEnvelope() {
        // Build a props with a base URL that fails URI parsing when
        // combined with the request path.
        final Dhis2Properties bad = new Dhis2Properties(
                new Dhis2Properties.Central("ht tp://broken/dhis", "u", "p", 1000),
                new Dhis2Properties.Compatibility(
                        "2.40", "2.44", "warn", true, 24, false,
                        "2.44-SNAPSHOT", false));
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), bad, true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET",
                "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        final String body = new String(res.getBody());
        assertThat(body).contains("\"code\":\"INVALID_REQUEST\"");
        assertThat(body).contains("\"httpStatus\":\"BadRequest\"");
    }

    @Test
    void taxonomyEnvelopesStillCarryCodeFieldForRealErrors() {
        // Unified envelope invariant for the ACTUAL error branches
        // (INVALID_REQUEST / UPSTREAM_UNAVAILABLE / UPSTREAM_INTERRUPTED):
        // every real-failure body still carries a `code` field so DER
        // tooling can distinguish them. The graceful-empty path now
        // bypasses this envelope entirely (200 shape-inferred body,
        // no code field — that's the whole point).
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), false, false, "",
                missProvider(miss));
        // UID segment forces the single-entity 404 path which still
        // uses notImplementedBody with the code field.
        final ResponseEntity<byte[]> res = p.proxy(
                new MockHttpServletRequest("GET", "/api/widgets/ABCdef12345"), null);
        assertThat(res.getStatusCode().value()).isEqualTo(404);
        final String body = new String(res.getBody());
        assertThat(body).contains("\"code\":\"EMULATOR_NOT_IMPLEMENTED\"");
    }

    @Test
    void gracefulEmptyReturnsUidNotFoundFor404Semantics() {
        // Unknown UID under a list resource → 404 (DHIS2's own
        // semantics). Apps destructure this cleanly ("object does
        // not exist").
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), true, false, "",
                missProvider(miss));
        final ResponseEntity<byte[]> res = p.proxy(
                new MockHttpServletRequest("GET", "/api/widgets/ABCdef12345"), null);
        assertThat(res.getStatusCode().value()).isEqualTo(404);
        assertThat(new String(res.getBody()))
                .contains("ABCdef12345")
                .contains("does not exist");
    }

    @Test
    void gracefulEmptyReturnsEmptyObjectForNestedPaths() {
        // Deep sub-resource path (not a UID) → empty object.
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), true, false, "",
                missProvider(miss));
        final ResponseEntity<byte[]> res = p.proxy(
                new MockHttpServletRequest("GET",
                        "/api/organisationUnits/level/stats"), null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(res.getBody())).isEqualTo("{}");
    }
}
