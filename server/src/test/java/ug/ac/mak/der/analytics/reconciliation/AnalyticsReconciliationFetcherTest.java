package ug.ac.mak.der.analytics.reconciliation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import ug.ac.mak.der.analytics.publication.PublicationProposal;
import ug.ac.mak.der.analytics.publication.PublicationRepository;
import ug.ac.mak.der.dhis2.Dhis2Properties;

class AnalyticsReconciliationFetcherTest {

    private PublicationRepository publications;
    private AnalyticsReconciliationService reconciliation;
    private HttpClient http;
    private Dhis2Properties dhis2;
    private AnalyticsReconciliationFetcher fetcher;
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach
    void setUp() {
        publications = mock(PublicationRepository.class);
        reconciliation = mock(AnalyticsReconciliationService.class);
        http = mock(HttpClient.class);
        dhis2 = new Dhis2Properties(
                new Dhis2Properties.Central(
                        "http://localhost:8080/dhis", "admin", "district", 10_000),
                null);
        fetcher = new AnalyticsReconciliationFetcher(publications,
                reconciliation, dhis2,
                new ReconciliationFetchProperties(300_000L, 7, 50, true),
                http, json);
    }

    private PublicationProposal published() {
        return new PublicationProposal(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), 1,
                "DS-UID", "DE-UID", "COC-UID", "AOC-UID",
                "202611", "OU-A",
                new BigDecimal("42"), new BigDecimal("42"),
                PublicationProposal.State.PUBLISHED, "ok",
                UUID.randomUUID(), Instant.now(),
                "{}", Instant.now(), Instant.now());
    }

    @SuppressWarnings("unchecked")
    private HttpResponse<String> response(final int status, final String body) {
        final HttpResponse<String> r = mock(HttpResponse.class);
        when(r.statusCode()).thenReturn(status);
        when(r.body()).thenReturn(body);
        return r;
    }

    @Test
    void parsesCentralValueFromAnalyticsRows() {
        final BigDecimal v = fetcher.parseValue(
                "{\"rows\":[[\"DE-UID\",\"202611\",\"OU-A\",\"42\"]]}");
        assertThat(v).isEqualByComparingTo("42");
    }

    @Test
    void parseReturnsNullForMissingRows() {
        assertThat(fetcher.parseValue("{}")).isNull();
        assertThat(fetcher.parseValue("{\"rows\":[]}")).isNull();
        assertThat(fetcher.parseValue(null)).isNull();
        assertThat(fetcher.parseValue("not-json")).isNull();
    }

    @Test
    void disabledShortCircuits() {
        fetcher = new AnalyticsReconciliationFetcher(publications,
                reconciliation, dhis2,
                new ReconciliationFetchProperties(300_000L, 7, 50, false),
                http, json);

        assertThat(fetcher.tick()).isZero();
        verify(publications, never()).listProposals(any(), any());
    }

    @Test
    void missingCentralBaseUrlShortCircuits() {
        dhis2 = new Dhis2Properties(
                new Dhis2Properties.Central("", null, null, 0), null);
        fetcher = new AnalyticsReconciliationFetcher(publications,
                reconciliation, dhis2,
                new ReconciliationFetchProperties(300_000L, 7, 50, true),
                http, json);

        assertThat(fetcher.tick()).isZero();
        verify(publications, never()).listProposals(any(), any());
    }

    @Test
    void successfulFetchFeedsReconciliationCompare() throws Exception {
        final PublicationProposal p = published();
        when(publications.listProposals(eq(null), eq("PUBLISHED")))
                .thenReturn(List.of(p));
        final HttpResponse<String> ok = response(200,
                "{\"rows\":[[\"DE-UID\",\"202611\",\"OU-A\",\"42\"]]}");
        when(http.<String>send(any(HttpRequest.class), any())).thenReturn(ok);
        when(reconciliation.compare(any())).thenReturn(
                new AnalyticsReconciliationService.CompareResult(1, 1,
                        AnalyticsReconciliationService
                                .emptyClassificationHistogram()));

        final int upserts = fetcher.tick();

        assertThat(upserts).isEqualTo(1);
        @SuppressWarnings("unchecked")
        final ArgumentCaptor<List<AnalyticsReconciliationService.CentralSample>>
                cap = ArgumentCaptor.forClass(List.class);
        verify(reconciliation, times(1)).compare(cap.capture());
        assertThat(cap.getValue()).hasSize(1);
        assertThat(cap.getValue().get(0).centralValue())
                .isEqualByComparingTo("42");
        assertThat(fetcher.stats().sampled()).isEqualTo(1L);
    }

    @Test
    void non2xxMarksFailureStillFeedsNullSample() throws Exception {
        final PublicationProposal p = published();
        when(publications.listProposals(eq(null), eq("PUBLISHED")))
                .thenReturn(List.of(p));
        final HttpResponse<String> down = response(503, "upstream");
        when(http.<String>send(any(HttpRequest.class), any())).thenReturn(down);
        when(reconciliation.compare(any())).thenReturn(
                new AnalyticsReconciliationService.CompareResult(1, 1,
                        AnalyticsReconciliationService
                                .emptyClassificationHistogram()));

        fetcher.tick();

        assertThat(fetcher.stats().fetchFailed()).isEqualTo(1L);
        // Null-centralValue sample is still passed through so the
        // classifier can distinguish LOCAL_PENDING_SYNC vs
        // CENTRAL_ANALYTICS_NOT_REFRESHED via publish cursor.
        verify(reconciliation).compare(any());
    }

    @Test
    void piReconciliationWithoutEngineRepoIsNoOp() {
        // engineRepo setter never called — the second direction
        // short-circuits so pre-PI wiring stays safe.
        assertThat(fetcher.reconcilePiMetrics()).isZero();
        verify(reconciliation, never()).compare(any());
    }

    @Test
    void piReconciliationFeedsSamplesForEachMaterialisedCell()
            throws Exception {
        final ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository engineRepo
                = mock(ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository.class);
        fetcher.setEngineRepo(engineRepo);
        final UUID metricId = UUID.randomUUID();
        final ug.ac.mak.der.analytics.engine.AnalyticsDefinition def
                = new ug.ac.mak.der.analytics.engine.AnalyticsDefinition(
                        metricId, "PI-ABC12345678",
                        "OPPI0001", "OPD attendance", 1,
                        "h", "EVENT", "COUNT", null, List.of(),
                        "EVENT_DATE", "EVENT_ORG_UNIT",
                        "READY", null, null, null, null);
        when(engineRepo.listPiBackedMetrics(anyInt()))
                .thenReturn(List.of(def));
        when(engineRepo.queryCells(any()))
                .thenReturn(List.of(
                        new ug.ac.mak.der.analytics.engine.AnalyticsCell(
                                metricId, 1, "202611", "OU-A", "",
                                3L, new BigDecimal("3"), new BigDecimal("3"),
                                null, null, Instant.now(), "VERIFIED")));
        final HttpResponse<String> ok = response(200,
                "{\"rows\":[[\"PI-ABC12345678\",\"202611\",\"OU-A\",\"3\"]]}");
        when(http.<String>send(any(HttpRequest.class), any())).thenReturn(ok);
        when(reconciliation.compare(any())).thenReturn(
                new AnalyticsReconciliationService.CompareResult(1, 1,
                        AnalyticsReconciliationService
                                .emptyClassificationHistogram()));

        assertThat(fetcher.reconcilePiMetrics()).isEqualTo(1);
        verify(reconciliation, times(1)).compare(any());
    }

    private static int anyInt() {
        return org.mockito.ArgumentMatchers.anyInt();
    }

    @Test
    void emptyPublishedListIsNoOp() {
        when(publications.listProposals(eq(null), eq("PUBLISHED")))
                .thenReturn(List.of());

        assertThat(fetcher.tick()).isZero();
        verify(reconciliation, never()).compare(any());
    }
}
