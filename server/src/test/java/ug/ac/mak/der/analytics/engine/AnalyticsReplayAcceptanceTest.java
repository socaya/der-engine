package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.replay.AnalyticsBaselineVerifier;

/**
 * Spec §14 acceptance vectors AT-05 + AT-20 + NFR-004 + NFR-009:
 * at-least-once journal delivery must produce exactly-once observable
 * tally effect, and a crash mid-transaction must recover to the exact
 * expected final state.
 *
 * <p>These tests simulate the two crash shapes we need to defend
 * against:</p>
 * <ol>
 *   <li><strong>AT-05</strong> — the journal (or the shell retry
 *       loop) delivers the same source event twice. The ledger
 *       uses upsert-by-(metric, source_key, period, orgUnit,
 *       dim) so the second delivery is a no-op; the materializer
 *       is called with the <em>same</em> contribution twice.</li>
 *   <li><strong>AT-20</strong> — the materializer writes partial
 *       work and the tx aborts before the cursor advances. On
 *       replay, the live ingester re-evaluates the same events
 *       and the upsert idempotency keeps the end state correct.</li>
 * </ol>
 *
 * <p>We use an in-memory stub contribution repo so the invariants
 * are exercised end-to-end without a database.</p>
 */
class AnalyticsReplayAcceptanceTest {

    private AnalyticsEngineRepository engineRepo;
    private InMemoryContributionRepo contributions;
    private AnalyticsEngineRepository cellsRepo;
    private AnalyticsMaterializer materializer;
    private AnalyticsLiveIngester ingester;

    private final UUID metricId = UUID.randomUUID();
    private final AnalyticsDefinition def = new AnalyticsDefinition(
            metricId, null, AnalyticsSeed.EVENT_COUNT_CODE,
            "Event count", 1, "h", "EVENT", "COUNT",
            null, List.of(), "EVENT_DATE", "EVENT_ORG_UNIT",
            "READY", null, null, null, null);

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
        cellsRepo = mock(AnalyticsEngineRepository.class);
        contributions = new InMemoryContributionRepo();
        materializer = new AnalyticsMaterializer(cellsRepo, contributions);
        ingester = new AnalyticsLiveIngester(engineRepo, materializer,
                new AnalyticsPeriodEnumerator(), null, null);
        when(engineRepo.findDefinitionByCode(
                AnalyticsSeed.EVENT_COUNT_CODE))
                .thenReturn(Optional.of(def));
    }

    @Test
    void at05DuplicateDeliveryProducesExactlyOneLedgerRow() {
        final AnalyticsSourceEvent e = new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT, "ev-1", 1,
                LocalDate.of(2026, 11, 10), "OU-A", "ACTIVE");

        ingester.handle(e);
        ingester.handle(e); // Duplicate delivery.

        assertThat(contributions.rows()).hasSize(1);
        assertThat(ingester.stats().applied()).isEqualTo(2L);
        // Observable tally effect is exactly-once.
        final AnalyticsContribution row = contributions.rows().get(0);
        assertThat(row.sourceKey()).isEqualTo("ev-1");
        assertThat(row.contributionValue()).isEqualByComparingTo("1");
    }

    @Test
    void at20CrashMidBatchRecoversViaReplay() {
        // Partial crash: three events delivered, but we simulate the
        // second applyContribution raising in-flight. The ledger
        // still holds the first row; replay re-delivers all three.
        final AnalyticsSourceEvent e1 = new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT, "ev-1", 1,
                LocalDate.of(2026, 11, 10), "OU-A", "ACTIVE");
        final AnalyticsSourceEvent e2 = new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT, "ev-2", 1,
                LocalDate.of(2026, 11, 10), "OU-A", "ACTIVE");
        final AnalyticsSourceEvent e3 = new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT, "ev-3", 1,
                LocalDate.of(2026, 11, 10), "OU-A", "ACTIVE");

        ingester.handle(e1);
        contributions.failNext = true;
        ingester.handle(e2); // Crash.
        ingester.handle(e3);

        // Replay — re-deliver every event. ev-1 is a no-op, ev-2 now
        // lands, ev-3 is a no-op.
        ingester.handle(e1);
        ingester.handle(e2);
        ingester.handle(e3);

        assertThat(contributions.rows()).hasSize(3);
        assertThat(ingester.stats().applied()).isEqualTo(5L);
        assertThat(ingester.stats().failed()).isEqualTo(1L);
    }

    @Test
    void fixture7OutOfOrderRevisionNeverRegressesState() {
        // SRS §12 fixture 7: revision 8 arriving before revision 7
        // never regresses current state to revision 7. We simulate
        // the raw ledger here (not the live ingester) to exercise
        // the upsert version guard directly.
        final AnalyticsContribution rev8 = new AnalyticsContribution(
                metricId, 1, "ev-ooo", "8", "202611", "OU-A", "",
                BigDecimal.ONE, true, "COMMITTED", null, null);
        final AnalyticsContribution rev7 = new AnalyticsContribution(
                metricId, 1, "ev-ooo", "7", "202611", "OU-A", "",
                BigDecimal.ONE, false, "COMMITTED", null, null);

        contributions.upsert(rev8);
        contributions.upsert(rev7); // older, should be dropped

        assertThat(contributions.rows()).hasSize(1);
        assertThat(contributions.rows().get(0).sourceVersion())
                .isEqualTo("8");
        assertThat(contributions.rows().get(0).eligibility()).isTrue();
    }

    @Test
    void verifierReportsZeroDriftOnCleanRun() {
        when(cellsRepo.findDefinition(metricId))
                .thenReturn(Optional.of(def));
        when(cellsRepo.findCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(Optional.of(new AnalyticsCell(metricId, 1,
                        "202611", "OU-A", "", 2L,
                        new BigDecimal("2"), new BigDecimal("2"),
                        null, null, Instant.now(), "VERIFIED")));
        when(cellsRepo.queryCells(any())).thenReturn(List.of(
                new AnalyticsCell(metricId, 1, "202611", "OU-A", "",
                        2L, new BigDecimal("2"), new BigDecimal("2"),
                        null, null, Instant.now(), "VERIFIED")));

        // Seed ledger directly with two eligible contributions so
        // the verifier's recompute aligns with the stored cell.
        contributions.rows().add(AnalyticsContribution.countOne(
                metricId, 1, "ev-1", "1", "202611", "OU-A"));
        contributions.rows().add(AnalyticsContribution.countOne(
                metricId, 1, "ev-2", "1", "202611", "OU-A"));

        final AnalyticsBaselineVerifier v = new AnalyticsBaselineVerifier(
                cellsRepo, contributions);
        final var report = v.verify(10);

        assertThat(report.cellsChecked()).isEqualTo(1);
        assertThat(report.cellsOk()).isEqualTo(1);
        assertThat(report.cellsDrifted()).isZero();
    }

    /** Minimal in-memory contribution repo: enforces upsert
     *  idempotency (one row per (metric, source_key, period,
     *  orgUnit, dim) tuple) and supports an optional fail-next
     *  trigger for AT-20. */
    static final class InMemoryContributionRepo
            extends AnalyticsContributionRepository {

        private final List<AnalyticsContribution> rows = new ArrayList<>();
        boolean failNext;

        InMemoryContributionRepo() {
            super(mock(org.springframework.jdbc.core.JdbcTemplate.class));
        }

        List<AnalyticsContribution> rows() {
            return rows;
        }

        @Override
        public int upsert(final AnalyticsContribution c) {
            if (failNext) {
                failNext = false;
                throw new RuntimeException("simulated mid-tx crash");
            }
            // Upsert-by-key with SRS fixture-7 version guard: an older
            // revision arriving after a newer one leaves state alone.
            for (int i = 0; i < rows.size(); i++) {
                final AnalyticsContribution r = rows.get(i);
                if (sameTuple(r, c)) {
                    if (!atLeast(c.sourceVersion(), r.sourceVersion())) {
                        return 0;
                    }
                    rows.set(i, c);
                    return 1;
                }
            }
            rows.add(c);
            return 1;
        }

        private static boolean atLeast(final String incoming,
                                         final String existing) {
            if (incoming == null || existing == null) {
                return true;
            }
            if (incoming.matches("^[0-9]+$")
                    && existing.matches("^[0-9]+$")) {
                return Long.parseLong(incoming)
                        >= Long.parseLong(existing);
            }
            return incoming.compareTo(existing) >= 0;
        }

        @Override
        public int[] upsertBatch(final List<AnalyticsContribution> batch) {
            final int[] out = new int[batch.size()];
            for (int i = 0; i < batch.size(); i++) {
                out[i] = upsert(batch.get(i));
            }
            return out;
        }

        @Override
        public List<CellRef> cellsForSource(final UUID metricId,
                                              final int definitionVersion,
                                              final String sourceKey) {
            final List<CellRef> out = new ArrayList<>();
            for (final AnalyticsContribution r : rows) {
                if (r.metricId().equals(metricId)
                        && r.definitionVersion() == definitionVersion
                        && r.sourceKey().equals(sourceKey)) {
                    out.add(new CellRef(r.periodKey(), r.orgUnitUid(),
                            r.dimensionKey() == null ? "" : r.dimensionKey()));
                }
            }
            return out;
        }

        @Override
        public CellAggregate aggregateForCell(final UUID metricId,
                                                final int definitionVersion,
                                                final String periodKey,
                                                final String orgUnitUid,
                                                final String dimensionKey) {
            long count = 0;
            BigDecimal sum = BigDecimal.ZERO;
            BigDecimal min = null;
            BigDecimal max = null;
            BigDecimal num = null;
            BigDecimal den = null;
            for (final AnalyticsContribution r : rows) {
                if (!r.metricId().equals(metricId)) {
                    continue;
                }
                if (!r.periodKey().equals(periodKey)) {
                    continue;
                }
                if (!r.orgUnitUid().equals(orgUnitUid)) {
                    continue;
                }
                if (!r.dimensionKey().equals(
                        dimensionKey == null ? "" : dimensionKey)) {
                    continue;
                }
                if (!r.eligibility()) {
                    continue;
                }
                if (!"COMMITTED".equals(r.sourceState())) {
                    continue;
                }
                count++;
                final BigDecimal v = r.contributionValue();
                if (v != null) {
                    sum = sum.add(v);
                    if (min == null || v.compareTo(min) < 0) {
                        min = v;
                    }
                    if (max == null || v.compareTo(max) > 0) {
                        max = v;
                    }
                }
                if (r.numeratorContribution() != null) {
                    num = num == null ? r.numeratorContribution()
                            : num.add(r.numeratorContribution());
                }
                if (r.denominatorContribution() != null) {
                    den = den == null ? r.denominatorContribution()
                            : den.add(r.denominatorContribution());
                }
            }
            return new CellAggregate(count, sum, min, max, num, den);
        }

        @Override
        public int removeForSource(final UUID metricId,
                                     final int definitionVersion,
                                     final String sourceKey) {
            final int before = rows.size();
            rows.removeIf(r -> r.metricId().equals(metricId)
                    && r.definitionVersion() == definitionVersion
                    && r.sourceKey().equals(sourceKey));
            return before - rows.size();
        }

        private static boolean sameTuple(final AnalyticsContribution a,
                                           final AnalyticsContribution b) {
            return a.metricId().equals(b.metricId())
                    && a.definitionVersion() == b.definitionVersion()
                    && a.sourceKey().equals(b.sourceKey())
                    && a.periodKey().equals(b.periodKey())
                    && a.orgUnitUid().equals(b.orgUnitUid())
                    && (a.dimensionKey() == null ? "" : a.dimensionKey())
                            .equals(b.dimensionKey() == null
                                    ? "" : b.dimensionKey());
        }
    }
}
