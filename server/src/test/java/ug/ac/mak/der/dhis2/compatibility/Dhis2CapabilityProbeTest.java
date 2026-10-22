package ug.ac.mak.der.dhis2.compatibility;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.Dhis2Properties;

class Dhis2CapabilityProbeTest {

    @Test
    void producesReportWhenCentralNotConfigured() {
        final Dhis2CapabilityProbe probe = new Dhis2CapabilityProbe(
                HttpClient.newHttpClient(),
                new Dhis2Properties.Central(null, null, null, 1000));
        final ProbeReport report = probe.run();
        assertThat(report.reachable()).isFalse();
        assertThat(report.outcomes()).hasSize(1);
        assertThat(report.outcomes().get(0).reachable()).isFalse();
    }

    @Test
    void producesReportWhenCentralBaseUrlBlank() {
        final Dhis2CapabilityProbe probe = new Dhis2CapabilityProbe(
                HttpClient.newHttpClient(),
                new Dhis2Properties.Central("", "u", "p", 1000));
        final ProbeReport report = probe.run();
        assertThat(report.reachable()).isFalse();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void capturesStatusAndDigestFromMockedClient() throws Exception {
        final HttpClient client = mock(HttpClient.class);
        final HttpResponse infoResp = mock(HttpResponse.class);
        when(infoResp.statusCode()).thenReturn(200);
        when(infoResp.body()).thenReturn("{\"version\":\"2.44\"}");
        final HttpResponse badResp = mock(HttpResponse.class);
        when(badResp.statusCode()).thenReturn(400);
        when(badResp.body()).thenReturn("{\"httpStatusCode\":400}");
        when(client.send(any(HttpRequest.class), any()))
                .thenReturn(infoResp, badResp, badResp, badResp, badResp,
                        badResp, badResp, badResp, badResp, badResp, badResp);

        final Dhis2CapabilityProbe probe = new Dhis2CapabilityProbe(
                client,
                new Dhis2Properties.Central("http://central/dhis", "u", "p", 1000));
        final ProbeReport report = probe.run();
        assertThat(report.reachable()).isTrue();
        assertThat(report.outcomes().get(0).status()).isEqualTo(200);
        assertThat(report.outcomes().get(0).shapeDigest()).isNotBlank();
    }

    @SuppressWarnings("unchecked")
    @Test
    void capturesIoFailureAsUnreachable() throws Exception {
        final HttpClient client = mock(HttpClient.class);
        when(client.send(any(HttpRequest.class), any()))
                .thenThrow(new IOException("boom"));
        final Dhis2CapabilityProbe probe = new Dhis2CapabilityProbe(
                client,
                new Dhis2Properties.Central("http://central/dhis", "u", "p", 1000));
        final ProbeReport report = probe.run();
        assertThat(report.reachable()).isFalse();
        assertThat(report.outcomes().get(0).status()).isEqualTo(-1);
        assertThat(report.outcomes().get(0).notes()).contains("io error");
    }

    @SuppressWarnings("unchecked")
    @Test
    void capturesInterruptAsUnreachable() throws Exception {
        final HttpClient client = mock(HttpClient.class);
        when(client.send(any(HttpRequest.class), any()))
                .thenThrow(new InterruptedException("stop"));
        final Dhis2CapabilityProbe probe = new Dhis2CapabilityProbe(
                client,
                new Dhis2Properties.Central("http://central/dhis", "u", "p", 1000));
        final ProbeReport report = probe.run();
        assertThat(report.outcomes().get(0).reachable()).isFalse();
        assertThat(report.outcomes().get(0).notes()).isEqualTo("interrupted");
        // Interrupt flag is set; clear so other tests do not see it.
        Thread.interrupted();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void anonymousProbeWhenUsernameBlank() throws Exception {
        final HttpClient client = mock(HttpClient.class);
        final HttpResponse ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn("{\"version\":\"2.44\"}");
        when(client.send(any(HttpRequest.class), any())).thenReturn(ok);
        final Dhis2CapabilityProbe probe = new Dhis2CapabilityProbe(
                client,
                new Dhis2Properties.Central("http://central/dhis", "", "", 1000));
        final ProbeReport report = probe.run();
        assertThat(report.outcomes().get(0).status()).isEqualTo(200);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void anonymousProbeWhenUsernameNull() throws Exception {
        final HttpClient client = mock(HttpClient.class);
        final HttpResponse ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn("{\"version\":\"2.44\"}");
        when(client.send(any(HttpRequest.class), any())).thenReturn(ok);
        final Dhis2CapabilityProbe probe = new Dhis2CapabilityProbe(
                client,
                new Dhis2Properties.Central("http://central/dhis", null, null, 1000));
        final ProbeReport report = probe.run();
        assertThat(report.outcomes().get(0).status()).isEqualTo(200);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void probeHandlesNullBody() throws Exception {
        final HttpClient client = mock(HttpClient.class);
        final HttpResponse ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn(null);
        when(client.send(any(HttpRequest.class), any())).thenReturn(ok);
        final Dhis2CapabilityProbe probe = new Dhis2CapabilityProbe(
                client,
                new Dhis2Properties.Central("http://central/dhis", "u", "p", 1000));
        final ProbeReport report = probe.run();
        assertThat(report.outcomes().get(0).shapeDigest()).isNull();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void probeHandlesUsernameWithNullPassword() throws Exception {
        final HttpClient client = mock(HttpClient.class);
        final HttpResponse ok = mock(HttpResponse.class);
        when(ok.statusCode()).thenReturn(200);
        when(ok.body()).thenReturn("{}");
        when(client.send(any(HttpRequest.class), any())).thenReturn(ok);
        final Dhis2CapabilityProbe probe = new Dhis2CapabilityProbe(
                client,
                new Dhis2Properties.Central("http://central/dhis", "u", null, 1000));
        final ProbeReport report = probe.run();
        assertThat(report.outcomes().get(0).status()).isEqualTo(200);
    }

    @Test
    void probeOutcomeRecordAccessors() {
        final ProbeOutcome o = new ProbeOutcome("/api/x", "GET", 200, 10L, "digest", "note", true);
        assertThat(o.endpoint()).isEqualTo("/api/x");
        assertThat(o.method()).isEqualTo("GET");
        assertThat(o.status()).isEqualTo(200);
        assertThat(o.durationMs()).isEqualTo(10L);
        assertThat(o.shapeDigest()).isEqualTo("digest");
        assertThat(o.notes()).isEqualTo("note");
        assertThat(o.reachable()).isTrue();
    }
}
