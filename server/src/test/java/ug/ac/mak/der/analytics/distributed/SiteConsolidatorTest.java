package ug.ac.mak.der.analytics.distributed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SiteConsolidatorTest {

    private SiteContributionRepository repo;

    private final UUID metricId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        repo = mock(SiteContributionRepository.class);
    }

    private SiteContributionPacket packet(final String siteId,
                                             final String ou,
                                             final long count,
                                             final long sum,
                                             final Instant producedAt) {
        return new SiteContributionPacket(siteId, UUID.randomUUID(),
                metricId, 1, "202611", ou, "",
                count, BigDecimal.valueOf(sum),
                BigDecimal.ONE, BigDecimal.valueOf(sum),
                null, null, count, producedAt,
                "abc", null);
    }

    private SiteConsolidator consolidator(
            final List<String> expectedSites,
            final long stalenessMinutes) {
        return new SiteConsolidator(repo,
                new ConsolidatorProperties(expectedSites,
                        stalenessMinutes));
    }

    @Test
    void emptyPacketsReturnsEmpty() {
        when(repo.findForQuery(any(), any(), anyInt()))
                .thenReturn(List.of());
        assertThat(consolidator(List.of(), 60L).consolidate(
                new SiteConsolidator.ConsolidateRequest(
                        List.of(), List.of(), 10)))
                .isEmpty();
    }

    @Test
    void mergesAcrossSitesAlgebraSafely() {
        when(repo.findForQuery(any(), any(), anyInt()))
                .thenReturn(List.of(
                        packet("site-a", "OU-A", 3L, 30L, Instant.now()),
                        packet("site-b", "OU-A", 4L, 40L, Instant.now())));

        final List<ConsolidatedCell> cells = consolidator(
                List.of("site-a", "site-b"), 60L * 24L)
                .consolidate(new SiteConsolidator.ConsolidateRequest(
                        List.of(), List.of(), 10));

        assertThat(cells).hasSize(1);
        final ConsolidatedCell c = cells.get(0);
        assertThat(c.totalCount()).isEqualTo(7L);
        assertThat(c.totalSum()).isEqualTo(new BigDecimal("70"));
        assertThat(c.reportingSites())
                .containsExactly("site-a", "site-b");
        assertThat(c.missingSites()).isEmpty();
        assertThat(c.completeness()).isEqualTo(1.0);
    }

    @Test
    void missingSitesReduceCompleteness() {
        when(repo.findForQuery(any(), any(), anyInt()))
                .thenReturn(List.of(
                        packet("site-a", "OU-A", 2L, 20L, Instant.now())));

        final ConsolidatedCell c = consolidator(
                List.of("site-a", "site-b", "site-c"), 60L * 24L)
                .consolidate(new SiteConsolidator.ConsolidateRequest(
                        List.of(), List.of(), 10)).get(0);

        assertThat(c.reportingSites()).containsExactly("site-a");
        assertThat(c.missingSites())
                .containsExactly("site-b", "site-c");
        assertThat(c.completeness()).isCloseTo(1.0 / 3.0,
                org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void stalePacketsFlaggedWithoutMissingCount() {
        final Instant stale = Instant.now().minusSeconds(3600);
        when(repo.findForQuery(any(), any(), anyInt()))
                .thenReturn(List.of(
                        packet("site-a", "OU-A", 1L, 10L, stale)));

        final ConsolidatedCell c = consolidator(List.of("site-a"), 5L)
                .consolidate(new SiteConsolidator.ConsolidateRequest(
                        List.of(), List.of(), 10)).get(0);

        assertThat(c.staleSites()).containsExactly("site-a");
        assertThat(c.reportingSites()).containsExactly("site-a");
        assertThat(c.missingSites()).isEmpty();
        assertThat(c.completeness()).isEqualTo(1.0);
    }

    @Test
    void latestPacketPerSiteWinsOnDuplicates() {
        // Two packets from site-a — older carries 2 rows, newer 5.
        // Only newer should fold into the merge.
        when(repo.findForQuery(any(), any(), anyInt()))
                .thenReturn(List.of(
                        packet("site-a", "OU-A", 2L, 20L,
                                Instant.parse("2026-11-01T00:00:00Z")),
                        packet("site-a", "OU-A", 5L, 50L,
                                Instant.parse("2026-11-10T00:00:00Z"))));

        final ConsolidatedCell c = consolidator(List.of("site-a"), 60L * 24L)
                .consolidate(new SiteConsolidator.ConsolidateRequest(
                        List.of(), List.of(), 10)).get(0);

        assertThat(c.totalCount()).isEqualTo(5L);
        assertThat(c.totalSum()).isEqualTo(new BigDecimal("50"));
    }

    @Test
    void differentCellCoordinatesAreSeparateRows() {
        when(repo.findForQuery(any(), any(), anyInt()))
                .thenReturn(List.of(
                        packet("site-a", "OU-A", 1L, 10L, Instant.now()),
                        packet("site-a", "OU-B", 2L, 20L, Instant.now())));

        final List<ConsolidatedCell> cells = consolidator(
                List.of("site-a"), 60L * 24L).consolidate(
                        new SiteConsolidator.ConsolidateRequest(
                                List.of(), List.of(), 10));

        assertThat(cells).hasSize(2);
    }
}
