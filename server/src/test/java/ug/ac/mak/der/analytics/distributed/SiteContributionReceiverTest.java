package ug.ac.mak.der.analytics.distributed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsContributionRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class SiteContributionReceiverTest {

    private AnalyticsEngineRepository engineRepo;
    private AnalyticsContributionRepository contributions;
    private SiteContributionRepository siteRepo;

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
        contributions = mock(AnalyticsContributionRepository.class);
        siteRepo = mock(SiteContributionRepository.class);
    }

    /** Produce a packet via the real exporter so the checksum is
     *  guaranteed to match what the receiver recomputes. */
    private SiteContributionPacket validPacket(final String site,
                                                  final UUID metric) {
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                new AnalyticsCell(metric, 1, "202611", "OU-A", "",
                        3L, new BigDecimal(3), new BigDecimal(3),
                        null, null, Instant.now(), "VERIFIED")));
        when(contributions.aggregateForCell(any(), anyInt(),
                anyString(), anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(3L, new BigDecimal(3),
                                new BigDecimal(1), new BigDecimal(2),
                                null, null));
        final var result = new SiteContributionExporter(engineRepo,
                contributions, site).export(
                new SiteContributionExporter.ExportRequest(
                        List.of(), List.of(), List.of(), null, 10));
        return result.packets().get(0);
    }

    @Test
    void emptyBatchReturnsAllZeros() {
        final var r = new SiteContributionReceiver(siteRepo)
                .ingest(List.of());
        assertThat(r.received()).isZero();
        assertThat(r.accepted()).isZero();
        assertThat(r.deduped()).isZero();
        assertThat(r.rejectedChecksum()).isZero();
    }

    @Test
    void checksumMatchIsAcceptedOnce() {
        final SiteContributionPacket p = validPacket("site-1",
                UUID.randomUUID());
        when(siteRepo.insertIfAbsent(p)).thenReturn(true);

        final var r = new SiteContributionReceiver(siteRepo)
                .ingest(List.of(p));

        assertThat(r.accepted()).isEqualTo(1);
        assertThat(r.deduped()).isZero();
        assertThat(r.rejectedChecksum()).isZero();
        assertThat(r.sitesTouched()).isEqualTo(1L);
    }

    @Test
    void duplicatePacketIsDedupedNotRejected() {
        final SiteContributionPacket p = validPacket("site-1",
                UUID.randomUUID());
        when(siteRepo.insertIfAbsent(p)).thenReturn(false);

        final var r = new SiteContributionReceiver(siteRepo)
                .ingest(List.of(p));

        assertThat(r.accepted()).isZero();
        assertThat(r.deduped()).isEqualTo(1);
    }

    @Test
    void checksumMismatchIsRejected() {
        final SiteContributionPacket legit = validPacket("site-1",
                UUID.randomUUID());
        final SiteContributionPacket tampered = new SiteContributionPacket(
                legit.siteId(), legit.packetId(),
                legit.metricId(), legit.definitionVersion(),
                legit.periodKey(), legit.orgUnitUid(),
                legit.dimensionKey(),
                legit.count() + 100,  // tampered
                legit.sum(), legit.min(), legit.max(),
                legit.numerator(), legit.denominator(),
                legit.sourceCursor(), legit.producedAt(),
                legit.checksumHex(), null);

        final var r = new SiteContributionReceiver(siteRepo)
                .ingest(List.of(tampered));

        assertThat(r.rejectedChecksum()).isEqualTo(1);
        assertThat(r.accepted()).isZero();
    }

    @Test
    void nullPacketsAreSkippedSilently() {
        final var r = new SiteContributionReceiver(siteRepo).ingest(
                java.util.Arrays.asList(null, null));
        assertThat(r.received()).isEqualTo(2);
        assertThat(r.accepted()).isZero();
        assertThat(r.rejectedChecksum()).isZero();
    }

    @Test
    void mixedBatchTouchesMultipleSites() {
        final SiteContributionPacket p1 = validPacket("site-1",
                UUID.randomUUID());
        final SiteContributionPacket p2 = validPacket("site-2",
                UUID.randomUUID());
        when(siteRepo.insertIfAbsent(any())).thenReturn(true);

        final var r = new SiteContributionReceiver(siteRepo)
                .ingest(List.of(p1, p2));

        assertThat(r.accepted()).isEqualTo(2);
        assertThat(r.sitesTouched()).isEqualTo(2L);
    }
}
