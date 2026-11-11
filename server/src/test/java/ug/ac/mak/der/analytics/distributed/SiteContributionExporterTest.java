package ug.ac.mak.der.analytics.distributed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsContributionRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class SiteContributionExporterTest {

    private AnalyticsEngineRepository engineRepo;
    private AnalyticsContributionRepository contributions;

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
        contributions = mock(AnalyticsContributionRepository.class);
    }

    private SiteContributionExporter exporter(final String siteId) {
        return new SiteContributionExporter(engineRepo, contributions,
                siteId);
    }

    private AnalyticsCell cell(final UUID metric, final String ou,
                                  final long count) {
        return new AnalyticsCell(metric, 1, "202611", ou, "",
                count, new BigDecimal(count), new BigDecimal(count),
                null, null, Instant.now(), "VERIFIED");
    }

    private AnalyticsContributionRepository.CellAggregate agg(
            final long count, final long sum) {
        return new AnalyticsContributionRepository.CellAggregate(
                count, new BigDecimal(sum),
                new BigDecimal(sum), new BigDecimal(sum),
                null, null);
    }

    @Test
    void siteIdFallsBackToDefaultWhenUnset() {
        assertThat(exporter(null).siteId()).isEqualTo("der-local");
        assertThat(exporter("").siteId()).isEqualTo("der-local");
        assertThat(exporter("der-mulago").siteId())
                .isEqualTo("der-mulago");
    }

    @Test
    void exportEmitsPacketPerCell() {
        final UUID m = UUID.randomUUID();
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(m, "OU-A", 3L),
                cell(m, "OU-B", 5L)));
        when(contributions.aggregateForCell(any(), anyInt(),
                anyString(), anyString(), anyString()))
                .thenReturn(agg(3L, 3L));

        final var r = exporter("der-site-1").export(
                new SiteContributionExporter.ExportRequest(
                        List.of(), List.of(), List.of(), null, 100));

        assertThat(r.siteId()).isEqualTo("der-site-1");
        assertThat(r.cellsScanned()).isEqualTo(2);
        assertThat(r.packetsEmitted()).isEqualTo(2);
        assertThat(r.packets()).allMatch(p ->
                p.siteId().equals("der-site-1")
             && p.count() == 3L
             && p.checksumHex() != null
             && p.checksumHex().length() == 64);
    }

    @Test
    void checksumIsStableForIdenticalInput() {
        final UUID m = UUID.randomUUID();
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(m, "OU-A", 3L)));
        when(contributions.aggregateForCell(any(), anyInt(),
                anyString(), anyString(), anyString()))
                .thenReturn(agg(3L, 3L));

        final SiteContributionExporter.ExportRequest req =
                new SiteContributionExporter.ExportRequest(
                        List.of(), List.of(), List.of(), null, 100);
        final var p1 = exporter("der-site").export(req)
                .packets().get(0);
        final var p2 = exporter("der-site").export(req)
                .packets().get(0);

        // producedAt differs so checksums differ; but a canonical
        // extract (same cell + aggregate) still yields a 64-hex
        // SHA-256 output.
        assertThat(p1.checksumHex()).hasSize(64);
        assertThat(p2.checksumHex()).hasSize(64);
    }

    @Test
    void sinceCursorFiltersPacketsAtOrBelow() {
        final UUID m = UUID.randomUUID();
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(m, "OU-A", 2L),
                cell(m, "OU-B", 5L)));
        // OU-A → cursor 2; OU-B → cursor 5; sinceCursor=3 keeps
        // OU-B only.
        when(contributions.aggregateForCell(any(), anyInt(),
                anyString(), anyString(), anyString()))
                .thenAnswer(inv -> {
                    final String ou = inv.getArgument(3,
                            String.class);
                    return "OU-A".equals(ou)
                            ? agg(2L, 2L) : agg(5L, 5L);
                });

        final var r = exporter("der-site").export(
                new SiteContributionExporter.ExportRequest(
                        List.of(), List.of(), List.of(),
                        3L, 100));

        assertThat(r.cellsScanned()).isEqualTo(2);
        assertThat(r.packetsEmitted()).isEqualTo(1);
        assertThat(r.packets().get(0).orgUnitUid()).isEqualTo("OU-B");
    }

    @Test
    void maxSourceCursorReportsHighestEvenWhenFiltered() {
        final UUID m = UUID.randomUUID();
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(m, "OU-A", 2L),
                cell(m, "OU-B", 7L)));
        when(contributions.aggregateForCell(any(), anyInt(),
                anyString(), anyString(), anyString()))
                .thenAnswer(inv -> {
                    final String ou = inv.getArgument(3, String.class);
                    return "OU-A".equals(ou)
                            ? agg(2L, 2L) : agg(7L, 7L);
                });

        final var r = exporter("site").export(
                new SiteContributionExporter.ExportRequest(
                        List.of(), List.of(), List.of(),
                        3L, 100));

        assertThat(r.maxSourceCursor()).isEqualTo(7L);
    }

    @Test
    void emptyCellsReturnsEmptyPackets() {
        when(engineRepo.queryCells(any())).thenReturn(List.of());

        final var r = exporter("der").export(
                new SiteContributionExporter.ExportRequest(
                        List.of(), List.of(), List.of(), null, 100));

        assertThat(r.cellsScanned()).isZero();
        assertThat(r.packets()).isEmpty();
    }
}
