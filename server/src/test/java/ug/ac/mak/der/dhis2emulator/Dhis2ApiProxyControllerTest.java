package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
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

    @Test
    void returns501WhenDisabled() {
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), false, false, "");
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(501);
        assertThat(new String(res.getBody())).contains("NotImplemented");
    }

    @Test
    void returns405OnWriteWhenNotAllowed() {
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), true, false, "");
        final MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(405);
        assertThat(new String(res.getBody())).contains("writes blocked");
    }

    @Test
    void returns403WhenPathNotOnAllowList() {
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), props(), true, false, "");
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/users");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(403);
        assertThat(new String(res.getBody())).contains("not in proxy allow-list");
    }

    @Test
    void customAllowListOverridesDefault() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse<byte[]> stub = response(200, "{\"ok\":true}");
        when(http.<byte[]>send(any(), any())).thenReturn(stub);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                http, props(), true, false, "/api/custom");
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/custom/stuff");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(res.getBody())).isEqualTo("{\"ok\":true}");
    }

    @Test
    void proxiesSuccessfulRead() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse<byte[]> stub = response(200, "{\"analytics\":[]}");
        when(http.<byte[]>send(any(), any())).thenReturn(stub);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                http, props(), true, false, "");
        final MockHttpServletRequest req = new MockHttpServletRequest("GET",
                "/api/analytics");
        req.setQueryString("dimension=dx:x&period=LAST_12_MONTHS");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(new String(res.getBody())).contains("analytics");
    }

    @Test
    void returns503WhenCentralNotConfigured() {
        final Dhis2Properties noCentral = new Dhis2Properties(
                new Dhis2Properties.Central("", "", "", 1000),
                new Dhis2Properties.Compatibility(
                        "2.40", "2.44", "warn", true, 24, false, "2.44-SNAPSHOT", false));
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                mock(HttpClient.class), noCentral, true, false, "");
        final MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/analytics");
        final ResponseEntity<byte[]> res = p.proxy(req, null);
        assertThat(res.getStatusCode().value()).isEqualTo(503);
    }

    @Test
    void allowsWritesWhenConfigured() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse<byte[]> stub = response(201, "{\"created\":true}");
        when(http.<byte[]>send(any(), any())).thenReturn(stub);
        final Dhis2ApiProxyController p = new Dhis2ApiProxyController(
                http, props(), true, true, "");
        final MockHttpServletRequest req = new MockHttpServletRequest("POST",
                "/api/dataStore/ns/key");
        req.setContent("{\"a\":1}".getBytes());
        final ResponseEntity<byte[]> res = p.proxy(req, "{\"a\":1}".getBytes());
        assertThat(res.getStatusCode().value()).isEqualTo(201);
    }
}
