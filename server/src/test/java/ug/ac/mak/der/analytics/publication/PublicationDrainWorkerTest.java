package ug.ac.mak.der.analytics.publication;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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

import ug.ac.mak.der.dhis2.Dhis2Properties;

class PublicationDrainWorkerTest {

    private PublicationRepository repo;
    private HttpClient http;
    private Dhis2Properties props;
    private PublicationDrainWorker worker;
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach
    void setUp() {
        repo = mock(PublicationRepository.class);
        http = mock(HttpClient.class);
        props = new Dhis2Properties(
                new Dhis2Properties.Central(
                        "http://localhost:8080/dhis", "admin", "district", 10_000),
                null);
        worker = new PublicationDrainWorker(repo, props,
                new PublicationProperties(BigDecimal.ZERO, 30_000L, 50, true),
                http, json);
    }

    private PublicationProposal approved(final String orgUnit) {
        return new PublicationProposal(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), 1,
                "DS", "DE", "COC", "AOC",
                "202611", orgUnit,
                new BigDecimal("42"), new BigDecimal("42"),
                PublicationProposal.State.APPROVED, "ok",
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
    void successfulImportFlipsAllRowsToPublished() throws Exception {
        final PublicationProposal a = approved("OU-A");
        final PublicationProposal b = approved("OU-B");
        final HttpResponse<String> ok = response(200,
                "{\"importCount\":{\"imported\":2,\"updated\":0,\"ignored\":0,\"deleted\":0}}");
        when(repo.listProposals(eq(null), eq("APPROVED")))
                .thenReturn(List.of(a, b));
        when(http.<String>send(any(HttpRequest.class), any()))
                .thenReturn(ok);

        final int published = worker.tick();

        assertThat(published).isEqualTo(2);
        verify(repo).review(eq(a.proposalId()),
                eq(PublicationProposal.State.PUBLISHED), any(),
                anyString(), any());
        verify(repo).review(eq(b.proposalId()),
                eq(PublicationProposal.State.PUBLISHED), any(),
                anyString(), any());
    }

    @Test
    void ignoredResponseMarksRowsDiverged() throws Exception {
        final PublicationProposal a = approved("OU-A");
        final HttpResponse<String> ignored = response(200,
                "{\"importCount\":{\"imported\":0,\"updated\":0,\"ignored\":1,\"deleted\":0}}");
        when(repo.listProposals(eq(null), eq("APPROVED")))
                .thenReturn(List.of(a));
        when(http.<String>send(any(HttpRequest.class), any()))
                .thenReturn(ignored);

        final int published = worker.tick();

        assertThat(published).isZero();
        verify(repo, times(1)).review(eq(a.proposalId()),
                eq(PublicationProposal.State.DIVERGED), any(),
                anyString(), any());
    }

    @Test
    void non2xxLeavesRowsAsApprovedForNextTick() throws Exception {
        final HttpResponse<String> down = response(503, "upstream");
        when(repo.listProposals(eq(null), eq("APPROVED")))
                .thenReturn(List.of(approved("OU-A")));
        when(http.<String>send(any(HttpRequest.class), any()))
                .thenReturn(down);

        final int published = worker.tick();

        assertThat(published).isZero();
        verify(repo, never()).review(any(), any(), any(), any(), any());
    }

    @Test
    void disabledConfigShortCircuits() throws Exception {
        worker = new PublicationDrainWorker(repo, props,
                new PublicationProperties(BigDecimal.ZERO, 30_000L, 50, false),
                http, json);
        when(repo.listProposals(eq(null), eq("APPROVED")))
                .thenReturn(List.of(approved("OU-A")));

        final int published = worker.tick();

        assertThat(published).isZero();
        verify(http, never()).send(any(), any());
    }

    @Test
    void missingCentralBaseUrlShortCircuits() throws Exception {
        final Dhis2Properties noUrl = new Dhis2Properties(
                new Dhis2Properties.Central("", null, null, 0), null);
        worker = new PublicationDrainWorker(repo, noUrl,
                new PublicationProperties(BigDecimal.ZERO, 30_000L, 50, true),
                http, json);

        assertThat(worker.tick()).isZero();
        verify(http, never()).send(any(), any());
    }
}
