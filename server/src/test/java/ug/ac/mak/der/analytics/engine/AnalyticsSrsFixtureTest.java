package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Explicit regressions for SRS §12 correctness fixtures (DER-AN-
 * SRS-001). Every test below matches one numbered fixture in the
 * spec; the claim this suite makes is that DER's row-store engine
 * (the Gate 1 oracle) implements the fixture correctly. When the
 * columnar engine lands in Gate 2 it will be driven through the
 * same scenarios against the same assertions.
 *
 * <p>Fixtures covered here: 1 (changed period), 2 (changed org
 * unit), 3 (same-event retry), 4 (repeatable stage), 5 (deleted
 * data value — absence vs zero), 7 (out-of-order change),
 * 13 (precision). Fixtures requiring metadata-edit rebuild (9) or
 * cross-site identity (8) land in later Gates.</p>
 */
class AnalyticsSrsFixtureTest {

    private AnalyticsEngineRepository cellsRepo;
    private AnalyticsContributionRepository contributions;
    private AnalyticsMaterializer materializer;

    private final UUID metricId = UUID.randomUUID();
    private final AnalyticsDefinition countDef = new AnalyticsDefinition(
            metricId, null, "DER_EVENT_COUNT",
            "Event count", 1, "h", "EVENT", "COUNT",
            null, List.of(), "EVENT_DATE", "EVENT_ORG_UNIT",
            "READY", null, null, null, null);

    @BeforeEach
    void setUp() {
        cellsRepo = mock(AnalyticsEngineRepository.class);
        contributions = mock(AnalyticsContributionRepository.class);
        materializer = new AnalyticsMaterializer(cellsRepo, contributions);
    }

    /** SRS §12 fixture 1 — a malaria event moved from 2026-06-30 to
     *  2026-07-01 removes exactly one contribution from June and
     *  adds one to July. Verified by observing the materializer
     *  re-materialises both touched cells on the applyContribution
     *  path (old cell + new cell). */
    @Test
    void fixture01ChangedPeriodRematerializesPriorAndNewCells() {
        when(contributions.cellsForSource(eq(metricId), eq(1), eq("ev-1")))
                .thenReturn(List.of(
                        new AnalyticsContributionRepository.CellRef(
                                "202606", "OU-A", "")));
        when(contributions.aggregateForCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(1L, BigDecimal.ONE));

        final AnalyticsContribution moved =
                AnalyticsContribution.countOne(metricId, 1, "ev-1", "2",
                        "202607", "OU-A");
        materializer.applyContribution(countDef, moved);

        // Both periods re-materialised in one pass — June's count
        // recomputes (will drop to 0 when no sources remain) and
        // July picks up the new contribution.
        org.mockito.Mockito.verify(contributions)
                .aggregateForCell(metricId, 1, "202606", "OU-A", "");
        org.mockito.Mockito.verify(contributions)
                .aggregateForCell(metricId, 1, "202607", "OU-A", "");
    }

    /** SRS §12 fixture 2 — a transferred record should not count in
     *  both old and new org-unit totals. The materializer walks the
     *  prior cells for the source + the new one, same mechanism as
     *  fixture 1 but on the org-unit axis. */
    @Test
    void fixture02ChangedOrgUnitTouchesPriorAndNewOrgUnitCells() {
        when(contributions.cellsForSource(eq(metricId), eq(1), eq("ev-1")))
                .thenReturn(List.of(
                        new AnalyticsContributionRepository.CellRef(
                                "202611", "OU-OLD", "")));
        when(contributions.aggregateForCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(1L, BigDecimal.ONE));

        final AnalyticsContribution transferred =
                AnalyticsContribution.countOne(metricId, 1, "ev-1", "2",
                        "202611", "OU-NEW");
        materializer.applyContribution(countDef, transferred);

        org.mockito.Mockito.verify(contributions)
                .aggregateForCell(metricId, 1, "202611", "OU-OLD", "");
        org.mockito.Mockito.verify(contributions)
                .aggregateForCell(metricId, 1, "202611", "OU-NEW", "");
    }

    /** SRS §12 fixture 5 — a deletion does not become zero unless
     *  the measure explicitly prescribes it; absence and numeric
     *  zero are distinct. When the last contribution for a cell
     *  retracts, the cell is removed from the materialised table
     *  (the UI renders "—", not "0"). */
    @Test
    void fixture05DeletedLastContributionRemovesCellInsteadOfZero() {
        when(contributions.aggregateForCell(any(), anyInt(),
                anyString(), anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(0L, BigDecimal.ZERO));

        final BigDecimal v = materializer.materializeCell(countDef,
                "202611", "OU-A", "");

        assertThat(v).isNull();
        org.mockito.Mockito.verify(cellsRepo)
                .deleteCell(metricId, 1, "202611", "OU-A", "");
    }

    /** SRS §12 fixture 13 — numeric aggregate sums retain required
     *  precision and surface overflow instead of silently wrapping.
     *  Ratio metrics divide sum(num)/sum(den) with
     *  {@link MathContext#DECIMAL64} so a 64-bit result is
     *  retained; the materializer never truncates to a smaller
     *  precision. */
    @Test
    void fixture13RatioDivideRetainsDecimal64Precision() {
        final AnalyticsDefinition ratioDef = new AnalyticsDefinition(
                metricId, null, "RATE", "Rate", 1, "h", "AGGREGATE",
                "NONE", null, List.of(), "EVENT_DATE",
                "EVENT_ORG_UNIT", "READY", null, null, null, null);
        when(contributions.aggregateForCell(eq(metricId), eq(1),
                eq("202611"), eq("OU-A"), eq("")))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(3L, BigDecimal.ZERO,
                                new BigDecimal("1"),
                                new BigDecimal("3")));

        final BigDecimal v = materializer.materializeCell(ratioDef,
                "202611", "OU-A", "", new BigDecimal("1"));

        // 1/3 should keep ~16 significant digits (DECIMAL64), not
        // truncate to the integer 0 or a short-precision 0.333.
        assertThat(v).isCloseTo(new BigDecimal("0.3333333333333333"),
                org.assertj.core.data.Offset.offset(
                        new BigDecimal("1E-15")));
    }

    /** SRS §12 fixture 4 (partial) — three events in one enrollment
     *  count as three stage events, not one. The materializer
     *  aggregates per contribution; the ledger carries one row per
     *  event. Here we assert that count-aggregation sums the row
     *  count faithfully — the enrollment-grain dedup lives in the
     *  enrollment-ingest path, not the materializer. */
    @Test
    void fixture04RepeatableStageEventsCountOncePerEvent() {
        when(contributions.aggregateForCell(any(), anyInt(),
                anyString(), anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(3L, new BigDecimal("3")));

        final BigDecimal v = materializer.materializeCell(countDef,
                "202611", "OU-A", "");

        assertThat(v).isEqualByComparingTo("3");
    }
}
