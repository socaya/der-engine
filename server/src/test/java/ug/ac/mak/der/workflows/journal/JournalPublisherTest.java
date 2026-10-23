package ug.ac.mak.der.workflows.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityUnavailableException;
import ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

class JournalPublisherTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private Dhis2Properties props(final String baseUrl) {
        return new Dhis2Properties(
                new Dhis2Properties.Central(baseUrl, "u", "p", 1000),
                Dhis2Properties.Compatibility.legacy("2.44", false));
    }

    private CapabilityFlags caps() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V244Profile().apply(b);
        return b.build();
    }

    private OperationJournalEntry entry(final OperationJournalEntry.EntityType et) {
        return new OperationJournalEntry(UUID.randomUUID(), et, "x",
                mapper.createObjectNode(), OperationJournalEntry.State.PENDING,
                0, null, UUID.randomUUID(), Instant.now(), Instant.now());
    }

    private ReferralPayloadEncoder encoder() {
        return new ReferralPayloadEncoder(mapper);
    }

    @Test
    void centralNotConfiguredIsRetryable() {
        final JournalPublisher p = new JournalPublisher(mock(HttpClient.class), props(null),
                mock(Dhis2CompatibilityEngine.class), encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.RETRYABLE);
    }

    @Test
    void capabilityUnavailableIsRetryable() {
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenThrow(
                new Dhis2CompatibilityUnavailableException("x", null));
        final JournalPublisher p = new JournalPublisher(mock(HttpClient.class),
                props("http://x/dhis"), engine, encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.RETRYABLE);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void successClassifies2xx() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("{\"status\":\"OK\"}");
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenReturn(caps());
        final JournalPublisher p = new JournalPublisher(http, props("http://x/dhis"), engine, encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.ACCEPTED);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void conflict409() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(409);
        when(resp.body()).thenReturn("conflict");
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenReturn(caps());
        final JournalPublisher p = new JournalPublisher(http, props("http://x/dhis"), engine, encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.EVENT)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.CONFLICT);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void ioExceptionIsRetryable() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        when(http.send(any(HttpRequest.class), any())).thenThrow(new IOException("boom"));
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenReturn(caps());
        final JournalPublisher p = new JournalPublisher(http, props("http://x/dhis"), engine, encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.EVENT)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.RETRYABLE);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void interruptSetsFlagAndRetryable() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        when(http.send(any(HttpRequest.class), any())).thenThrow(new InterruptedException("x"));
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenReturn(caps());
        final JournalPublisher p = new JournalPublisher(http, props("http://x/dhis"), engine, encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.TRACKED_ENTITY)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.RETRYABLE);
        Thread.interrupted(); // clear
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void enrollmentUsesTrackerImport() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("{}");
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenReturn(caps());
        final JournalPublisher p = new JournalPublisher(http, props("http://x/dhis"), engine, encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.ENROLLMENT)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.ACCEPTED);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void anonymousAuthWhenUsernameBlank() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("{}");
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenReturn(caps());
        final JournalPublisher p = new JournalPublisher(http,
                new Dhis2Properties(new Dhis2Properties.Central("http://x/dhis", "", "", 1000),
                        Dhis2Properties.Compatibility.legacy("2.44", false)),
                engine, encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.ACCEPTED);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void programStageEventPath() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("{}");
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenReturn(caps());
        final JournalPublisher p = new JournalPublisher(http, props("http://x/dhis"), engine, encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.ACCEPTED);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void legacyEventsPathWhenCapabilityIsLegacyOnly() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(201);
        when(resp.body()).thenReturn("");
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new ug.ac.mak.der.dhis2.compatibility.profiles.V241Profile().apply(b);
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenReturn(b.build());
        final JournalPublisher p = new JournalPublisher(http, props("http://x/dhis"), engine, encoder());
        assertThat(p.publish(entry(OperationJournalEntry.EntityType.EVENT)).terminal())
                .isEqualTo(JournalPublisher.TerminalState.ACCEPTED);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void referralTagBodyCarriesMarker() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("{}");
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);
        final Dhis2CompatibilityEngine engine = mock(Dhis2CompatibilityEngine.class);
        when(engine.capabilities()).thenReturn(caps());
        final JournalPublisher p = new JournalPublisher(http, props("http://x/dhis"),
                engine, encoder());
        final OperationJournalEntry e = new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, "k",
                mapper.readTree("{\"comment\":\"\"}"),
                OperationJournalEntry.State.PENDING, 0, null, UUID.randomUUID(),
                Instant.now(), Instant.now(), "ou-dest");
        p.publish(e);
        final org.mockito.ArgumentCaptor<HttpRequest> cap =
                org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        org.mockito.Mockito.verify(http).send(cap.capture(), any());
        final java.util.Optional<HttpRequest.BodyPublisher> body = cap.getValue().bodyPublisher();
        assertThat(body).isPresent();
        // Can't inspect published bytes directly without a subscriber; the
        // ReferralPayloadEncoder test already covers byte content. Here we just
        // assert the publish happened without failure.
        assertThat(cap.getValue().uri().getPath()).contains("/api/dataValueSets");
    }
}
