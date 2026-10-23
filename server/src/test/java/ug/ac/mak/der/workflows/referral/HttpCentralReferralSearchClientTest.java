package ug.ac.mak.der.workflows.referral;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.Dhis2Properties;

class HttpCentralReferralSearchClientTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    private Dhis2Properties props(final String baseUrl) {
        return new Dhis2Properties(
                new Dhis2Properties.Central(baseUrl, "u", "p", 1000),
                Dhis2Properties.Compatibility.legacy("2.44", false));
    }

    private HttpCentralReferralSearchClient newClient(final HttpClient http,
                                                        final String baseUrl) {
        return new HttpCentralReferralSearchClient(http, props(baseUrl), mapper);
    }

    @Test
    void emptyBaseUrlReturnsEmpty() {
        assertThat(newClient(mock(HttpClient.class), null).findReferrals("ou", NOW)).isEmpty();
        assertThat(newClient(mock(HttpClient.class), "").findReferrals("ou", NOW)).isEmpty();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void parsesMarkerMatchingBoundOu() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("{\"dataValues\":["
                + "{\"dataElement\":\"de1\",\"orgUnit\":\"ou-src\","
                + "\"period\":\"2026Q1\",\"categoryOptionCombo\":\"coc1\","
                + "\"value\":\"5\",\"comment\":\"BP high [DER-next-hop:ou-dest]\"},"
                + "{\"dataElement\":\"de2\",\"orgUnit\":\"ou-src\","
                + "\"period\":\"2026Q1\",\"categoryOptionCombo\":\"coc1\","
                + "\"value\":\"3\",\"comment\":\"no marker\"},"
                + "{\"dataElement\":\"de3\",\"orgUnit\":\"ou-src\","
                + "\"period\":\"2026Q1\",\"categoryOptionCombo\":\"coc1\","
                + "\"value\":\"1\",\"comment\":\"[DER-next-hop:other-ou]\"}]}");
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);
        final List<CentralReferralSearchClient.Candidate> out =
                newClient(http, "http://x/dhis").findReferrals("ou-dest", NOW);
        assertThat(out).hasSize(1);
        assertThat(out.get(0).kind()).isEqualTo(ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE);
        assertThat(out.get(0).sourceRef()).isEqualTo("de1|ou-src|2026Q1|coc1");
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void non2xxReturnsEmpty() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(500);
        when(resp.body()).thenReturn("err");
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);
        assertThat(newClient(http, "http://x/dhis").findReferrals("ou", NOW)).isEmpty();
    }

    @Test
    void ioFailureReturnsEmpty() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        when(http.send(any(HttpRequest.class), any())).thenThrow(new java.io.IOException("x"));
        assertThat(newClient(http, "http://x/dhis").findReferrals("ou", NOW)).isEmpty();
    }

    @Test
    void interruptedReturnsEmpty() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        when(http.send(any(HttpRequest.class), any())).thenThrow(new InterruptedException("x"));
        assertThat(newClient(http, "http://x/dhis").findReferrals("ou", NOW)).isEmpty();
        // Clear the interrupt flag the client set
        Thread.interrupted();
    }

    @Test
    void parseEmptyBodyReturnsEmpty() {
        assertThat(newClient(mock(HttpClient.class), "http://x")
                .parse("", "ou")).isEmpty();
        assertThat(newClient(mock(HttpClient.class), "http://x")
                .parse(null, "ou")).isEmpty();
    }

    @Test
    void parseMalformedJsonReturnsEmpty() {
        assertThat(newClient(mock(HttpClient.class), "http://x")
                .parse("not json", "ou")).isEmpty();
    }

    @Test
    void parsePayloadWithoutDataValuesReturnsEmpty() {
        assertThat(newClient(mock(HttpClient.class), "http://x")
                .parse("{\"foo\":1}", "ou")).isEmpty();
        assertThat(newClient(mock(HttpClient.class), "http://x")
                .parse("{\"dataValues\":\"not an array\"}", "ou")).isEmpty();
    }

    @Test
    void parseSkipsDataValueWithoutCommentField() {
        assertThat(newClient(mock(HttpClient.class), "http://x")
                .parse("{\"dataValues\":[{\"dataElement\":\"de\"}]}", "ou")).isEmpty();
    }

    @Test
    void parsePopulatesSourceRefDashesForMissingFields() {
        final List<CentralReferralSearchClient.Candidate> out = newClient(
                mock(HttpClient.class), "http://x")
                .parse("{\"dataValues\":[{\"comment\":\"[DER-next-hop:ou]\"}]}", "ou");
        assertThat(out).hasSize(1);
        assertThat(out.get(0).sourceRef()).isEqualTo("-|-|-|-");
    }
}
