package ug.ac.mak.der.dhis2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.fasterxml.jackson.databind.ObjectMapper;

class Dhis2ReferenceClientTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void fetchesVersionFromCentral() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn("{\"version\":\"2.44-SNAPSHOT\",\"revision\":\"abc1234\",\"buildTime\":\"2026-08-19T23:39:17.000\"}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(ok);

        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://localhost:8080/dhis", "admin", "district", 5000));

        final Dhis2Version v = client.fetchVersion();
        assertThat(v.version()).isEqualTo("2.44-SNAPSHOT");
        assertThat(v.revision()).isEqualTo("abc1234");
        assertThat(v.buildTime()).isEqualTo("2026-08-19T23:39:17.000");

        final ArgumentCaptor<HttpRequest> req = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(req.capture(), any());
        final HttpRequest sent = req.getValue();
        assertThat(sent.uri()).isEqualTo(URI.create("http://localhost:8080/dhis/api/system/info"));
        assertThat(sent.method()).isEqualTo("GET");
        assertThat(sent.headers().firstValue("Accept")).contains("application/json");
        final String expectedAuth = "Basic " + Base64.getEncoder()
                .encodeToString("admin:district".getBytes(StandardCharsets.UTF_8));
        assertThat(sent.headers().firstValue("Authorization")).contains(expectedAuth);
    }

    @Test
    void omitsBasicAuthWhenUsernameBlank() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn("{\"version\":\"2.44-SNAPSHOT\"}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(ok);

        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://host/dhis", "", "", 5000));

        client.fetchVersion();
        final ArgumentCaptor<HttpRequest> req = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(req.capture(), any());
        assertThat(req.getValue().headers().firstValue("Authorization")).isEmpty();
    }

    @Test
    void defaultsPasswordToEmptyStringWhenNull() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn("{\"version\":\"2.44-SNAPSHOT\"}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(ok);

        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", "admin", null, 5000));

        client.fetchVersion();
        final ArgumentCaptor<HttpRequest> req = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(req.capture(), any());
        final String expected = "Basic " + Base64.getEncoder()
                .encodeToString("admin:".getBytes(StandardCharsets.UTF_8));
        assertThat(req.getValue().headers().firstValue("Authorization")).contains(expected);
    }

    @Test
    void blankBaseUrlThrowsUnreachable() {
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(mock(HttpClient.class), mapper,
                new Dhis2Properties.Central("", "u", "p", 5000));
        assertThatThrownBy(client::fetchVersion)
                .isInstanceOf(Dhis2ReferenceClient.Dhis2UnreachableException.class)
                .hasMessageContaining("base-url");
    }

    @Test
    void nullBaseUrlThrowsUnreachable() {
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(mock(HttpClient.class), mapper,
                new Dhis2Properties.Central(null, null, null, 5000));
        assertThatThrownBy(client::fetchVersion)
                .isInstanceOf(Dhis2ReferenceClient.Dhis2UnreachableException.class);
    }

    @Test
    void non2xxBecomesUnreachable() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> notFound = mock(HttpResponse.class);
        when(notFound.statusCode()).thenReturn(404);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(notFound);
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", "u", "p", 5000));
        assertThatThrownBy(client::fetchVersion)
                .isInstanceOf(Dhis2ReferenceClient.Dhis2UnreachableException.class)
                .hasMessageContaining("404");
    }

    @Test
    void ioExceptionBecomesUnreachable() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new IOException("boom"));
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", "u", "p", 5000));
        assertThatThrownBy(client::fetchVersion)
                .isInstanceOf(Dhis2ReferenceClient.Dhis2UnreachableException.class)
                .hasMessageContaining("I/O");
    }

    @Test
    void interruptedBecomesUnreachableAndRestoresFlag() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new InterruptedException("stop"));
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", "u", "p", 5000));
        Thread.interrupted(); // clear prior flag before the call
        assertThatThrownBy(client::fetchVersion)
                .isInstanceOf(Dhis2ReferenceClient.Dhis2UnreachableException.class);
        assertThat(Thread.interrupted()).isTrue();
    }

    @Test
    void malformedJsonBecomesResponseException() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("not json");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", "u", "p", 5000));
        assertThatThrownBy(client::fetchVersion)
                .isInstanceOf(Dhis2ReferenceClient.Dhis2ResponseException.class);
    }

    @Test
    void missingVersionFieldBecomesResponseException() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("{\"revision\":\"x\"}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", "u", "p", 5000));
        assertThatThrownBy(client::fetchVersion)
                .isInstanceOf(Dhis2ReferenceClient.Dhis2ResponseException.class)
                .hasMessageContaining("version");
    }

    @Test
    void blankVersionFieldBecomesResponseException() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("{\"version\":\"   \"}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", "u", "p", 5000));
        assertThatThrownBy(client::fetchVersion)
                .isInstanceOf(Dhis2ReferenceClient.Dhis2ResponseException.class);
    }

    @Test
    void omitsBasicAuthWhenUsernameIsNull() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn("{\"version\":\"2.44-SNAPSHOT\"}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(ok);

        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://host/dhis", null, "ignored", 5000));
        client.fetchVersion();
        final ArgumentCaptor<HttpRequest> req = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(req.capture(), any());
        assertThat(req.getValue().headers().firstValue("Authorization")).isEmpty();
    }

    @Test
    void nonTextualVersionFieldBecomesResponseException() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("{\"version\":244}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", null, null, 5000));
        assertThatThrownBy(client::fetchVersion)
                .isInstanceOf(Dhis2ReferenceClient.Dhis2ResponseException.class);
    }

    @Test
    void nonTextualRevisionFieldIsIgnored() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        // revision/buildTime are present but as numbers — client treats them as null.
        when(resp.body()).thenReturn("{\"version\":\"2.44-SNAPSHOT\",\"revision\":1234,\"buildTime\":5678}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);
        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", null, null, 5000));
        final Dhis2Version v = client.fetchVersion();
        assertThat(v.revision()).isNull();
        assertThat(v.buildTime()).isNull();
    }

    @Test
    void respectsConfiguredTimeoutLowerBound() throws Exception {
        // 100 ms is below the 1000 ms floor the client enforces; it should still
        // issue the request with a request.timeout() of at least 1 second.
        final HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        final HttpResponse<String> ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn("{\"version\":\"2.44-SNAPSHOT\"}");
        when(http.send(any(HttpRequest.class), eq(HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))))
                .thenReturn(ok);
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(ok);

        final Dhis2ReferenceClient client = new Dhis2ReferenceClient(http, mapper,
                new Dhis2Properties.Central("http://h/dhis", "u", "p", 100));
        client.fetchVersion();
        final ArgumentCaptor<HttpRequest> cap = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(cap.capture(), any());
        assertThat(cap.getValue().timeout().orElseThrow().toMillis()).isGreaterThanOrEqualTo(1_000L);
    }
}
