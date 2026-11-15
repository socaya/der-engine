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
    void returnsEmulatorNotImplementedWhenDisabled() {
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), false, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(404);
        assertThat(new String(res.getBody())).contains("EMULATOR_NOT_IMPLEMENTED");
        verify(miss).record(eq("/api/analytics"), eq(""));
    }

    @Test
    void returnsEmulatorNotImplementedOnWriteWhenNotAllowed() {
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(404);
        assertThat(new String(res.getBody())).contains("EMULATOR_NOT_IMPLEMENTED");
        assertThat(new String(res.getBody())).contains("Writes to this endpoint are blocked");
        verify(miss).record(eq("/api/analytics"), eq(""));
    }

    @Test
    void returnsEmulatorNotImplementedWhenPathNotOnAllowList() {
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(404);
        assertThat(new String(res.getBody())).contains("EMULATOR_NOT_IMPLEMENTED");
        assertThat(new String(res.getBody())).contains("not on the proxy allow-list");
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
    void returnsEmulatorNotImplementedWhenCentralNotConfigured() {
        final Dhis2Properties noCentral = new Dhis2Properties(
                new Dhis2Properties.Central("", "", "", 1000),
                new Dhis2Properties.Compatibility(
                        "2.40", "2.44", "warn", true, 24, false, "2.44-SNAPSHOT", false));
        final EmulatorMissRepository miss = mock(EmulatorMissRepository.class);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), noCentral, true, false, "", missProvider(miss));
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(404);
        assertThat(new String(res.getBody())).contains("EMULATOR_NOT_IMPLEMENTED");
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
}
