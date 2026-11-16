package ug.ac.mak.der.nfr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;

import ug.ac.mak.der.observability.DerMetrics;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry.State;
import ug.ac.mak.der.workflows.journal.JournalInFlightReaperRunner;

/**
 * NFR-12 — "Each eligible journal operation has a traceable
 * pending / accepted / rejected / uncertain / review-required
 * outcome." NFR-13 — "Application/sync restart yields no missing
 * committed operations and restores consistent processing state."
 *
 * <p>Pins two invariants against the live journal state machine:
 * <ol>
 *   <li><b>NFR-12 accounting exhaustiveness.</b> Every value of
 *       {@link State} must map to exactly one of the five
 *       public-outcome buckets the acceptance text names. If a new
 *       state lands on the enum without a corresponding bucket, the
 *       mapping function throws and this test fails — operators
 *       would otherwise see an uncategorised journal row and be
 *       unable to progress it.</li>
 *   <li><b>NFR-13 restart recoverability.</b> Simulates the
 *       {@code ApplicationReadyEvent} handshake the
 *       {@link JournalInFlightReaperRunner} does at process start:
 *       {@code requeueOrphanedInFlight} flips every
 *       {@code IN_FLIGHT} row back to {@code PENDING} so the drain
 *       worker can pick them up on its next tick; terminal rows
 *       ({@code CENTRAL_ACCEPTED}, {@code CENTRAL_REJECTED}),
 *       review rows ({@code CONFLICT_REVIEW}), uncertain rows
 *       ({@code UNKNOWN_OUTCOME}), and retry rows
 *       ({@code RETRYABLE}) MUST be left untouched. One
 *       {@code JOURNAL_INFLIGHT_REAPED} audit event must be
 *       emitted iff rows were reaped — a zero-op restart writes no
 *       audit noise.</li>
 * </ol>
 * </p>
 *
 * <p>Fault injection is deliberate at the repo boundary: the real
 * {@code UPDATE ... WHERE state='IN_FLIGHT'} is exercised via a
 * mocked {@link JdbcTemplate} so we can assert the exact predicate
 * + state transition, and separately verify the reaper's audit
 * contract without standing up Postgres. The companion test
 * {@code OperationJournalRepositoryTest#findPendingReadyToDrainPredicatePreservesSupersedesGuard}
 * pins the complementary FR-11-10 drain predicate; together, these
 * tests cover the invariant "nothing's left hanging across a
 * restart."</p>
 */
class Nfr12Nfr13AccountingAndRecoverabilityScenarioTest {

    /**
     * NFR-12 bucket taxonomy — public-outcome labels from the NFR-12
     * acceptance text. The mapping is what operators and the pilot
     * evidence script see; the internal state is DER's lifecycle
     * telemetry.
     */
    private enum PublicOutcome {
        PENDING,        // operation accepted locally, awaiting drain
        ACCEPTED,       // central has acknowledged
        REJECTED,       // central refused (classified, terminal)
        UNCERTAIN,      // drain completed but central answer indeterminate
        REVIEW_REQUIRED // operator must decide (conflict/merge)
    }

    /**
     * The one and only mapping from internal state → public outcome.
     * Any new {@link State} lands with no mapping and the test's
     * exhaustiveness assertion fails — the regression tells reviewers
     * to pick a bucket before merging.
     */
    private static PublicOutcome bucket(final State state) {
        return switch (state) {
            // The drain-worker pipeline: both are "operation is in
            // the system and will reach a terminal answer; central
            // has not acknowledged yet." PENDING is at rest;
            // IN_FLIGHT is a brief transient the publisher thread
            // holds. From an operator's perspective both are
            // "pending" — they are the two sub-states of it.
            case PENDING, IN_FLIGHT, RETRYABLE -> PublicOutcome.PENDING;
            case CENTRAL_ACCEPTED -> PublicOutcome.ACCEPTED;
            case CENTRAL_REJECTED -> PublicOutcome.REJECTED;
            case UNKNOWN_OUTCOME -> PublicOutcome.UNCERTAIN;
            case CONFLICT_REVIEW -> PublicOutcome.REVIEW_REQUIRED;
        };
    }

    @Test
    void nfr12EveryJournalStateMapsToExactlyOneOperatorBucket() {
        // Exhaustiveness invariant: a new state on the enum will
        // land here with no switch arm, forcing the reviewer to add
        // a bucket. The switch has no default arm so the compiler
        // flags the gap before this test even runs — belt + braces.
        for (final State s : State.values()) {
            final PublicOutcome out = bucket(s);
            // The bucket must be one of the five NFR-12 labels — no
            // stray value. (The enum's own type-checker enforces
            // this; the assert pins the invariant for review.)
            assertThat(EnumSet.of(PublicOutcome.PENDING,
                    PublicOutcome.ACCEPTED,
                    PublicOutcome.REJECTED,
                    PublicOutcome.UNCERTAIN,
                    PublicOutcome.REVIEW_REQUIRED))
                    .as("every State → one of the five NFR-12 buckets")
                    .contains(out);
        }
        // Every bucket must be reachable from at least one state —
        // otherwise a labelled outcome is dead code, and the pilot's
        // evidence bundle will show a bucket that never surfaces
        // from the real pipeline.
        final EnumSet<PublicOutcome> reached = EnumSet.noneOf(PublicOutcome.class);
        for (final State s : State.values()) {
            reached.add(bucket(s));
        }
        assertThat(reached)
                .as("every NFR-12 bucket backed by at least one State")
                .containsExactlyInAnyOrder(PublicOutcome.values());
    }

    @Test
    void nfr13RestartReaperRequeuesInFlightButLeavesTerminalRowsUntouched() {
        // The reaper runs ONE SQL UPDATE. We pin its exact predicate
        // via a mocked JdbcTemplate so a refactor that broadens it
        // (reverting an ACCEPTED/REJECTED row to PENDING, which would
        // break NFR-13's "no missing committed operations") is caught
        // in CI. The seed is a count the reaper is told it flipped;
        // the audit + metrics calls MUST see that same count.
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString())).thenReturn(3); // 3 orphans reaped
        final OperationJournalRepository repo =
                new OperationJournalRepository(jdbc, new ObjectMapper());

        final List<String> sqlSeen = new ArrayList<>();
        when(jdbc.update(anyString())).thenAnswer(inv -> {
            sqlSeen.add(inv.getArgument(0));
            return 3;
        });
        final int reaped = repo.requeueOrphanedInFlight();
        assertThat(reaped).as("rows the reaper claims to have requeued").isEqualTo(3);
        // The single UPDATE must restrict itself to IN_FLIGHT — that
        // is the whole NFR-13 invariant on the repo side.
        assertThat(sqlSeen).hasSize(1);
        final String sql = sqlSeen.get(0);
        assertThat(sql)
                .as("reaper SQL only touches IN_FLIGHT rows")
                .contains("WHERE state = 'IN_FLIGHT'")
                .contains("SET state = 'PENDING'");
        // Terminal + review states MUST never appear in the WHERE
        // clause — otherwise a committed CENTRAL_ACCEPTED row could
        // flip back to PENDING on a restart and be re-published,
        // producing a duplicate landing at central.
        assertThat(sql)
                .as("reaper refuses to touch any terminal / review state")
                .doesNotContainPattern("state\\s*=\\s*'CENTRAL_ACCEPTED'")
                .doesNotContainPattern("state\\s*=\\s*'CENTRAL_REJECTED'")
                .doesNotContainPattern("state\\s*=\\s*'CONFLICT_REVIEW'")
                .doesNotContainPattern("state\\s*=\\s*'UNKNOWN_OUTCOME'")
                .doesNotContainPattern("state\\s*=\\s*'RETRYABLE'");

        // Now wire the runner (the thing that actually fires on
        // ApplicationReadyEvent in a real boot) with the same repo
        // + a captured audit sink + metrics, and simulate the boot
        // tick. The audit + metrics contract matters because pilot
        // ops read these to spot how many rows a crash cost.
        final OperationJournalRepository reaperRepo = mock(OperationJournalRepository.class);
        when(reaperRepo.requeueOrphanedInFlight()).thenReturn(3);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final DerMetrics metrics = mock(DerMetrics.class);
        final JournalInFlightReaperRunner runner = new JournalInFlightReaperRunner(
                reaperRepo, audit, metrics);
        runner.reapOnBoot();
        verify(reaperRepo).requeueOrphanedInFlight();
        verify(audit).append(any(AuditEvent.class), any());
        verify(metrics).inflightReaped(eq("boot"), eq(3));
    }

    @Test
    void nfr13CleanRestartEmitsNeitherAuditNorMetric() {
        // Idempotence invariant — a normal restart (zero orphans) MUST
        // be silent. A spurious JOURNAL_INFLIGHT_REAPED audit on every
        // boot would train operators to ignore it, defeating the
        // NFR-13 observability contract when a real crash hits.
        final OperationJournalRepository repo = mock(OperationJournalRepository.class);
        when(repo.requeueOrphanedInFlight()).thenReturn(0);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final DerMetrics metrics = mock(DerMetrics.class);
        final JournalInFlightReaperRunner runner = new JournalInFlightReaperRunner(
                repo, audit, metrics);
        runner.reapOnBoot();
        verify(repo).requeueOrphanedInFlight();
        verifyNoInteractions(audit);
        verifyNoInteractions(metrics);
    }

    @Test
    void nfr12OutcomeDistributionShapeMatchesEvidenceSchema() {
        // Shape pin for the evidence export: a Map<PublicOutcome,
        // List<State>> that downstream reporting scripts can lift
        // into a TP / FP / FN style table. If this shape changes
        // without updating the evidence pipeline, this test flags it.
        final Map<PublicOutcome, List<State>> distribution = new LinkedHashMap<>();
        for (final PublicOutcome b : PublicOutcome.values()) {
            distribution.put(b, new ArrayList<>());
        }
        for (final State s : State.values()) {
            distribution.get(bucket(s)).add(s);
        }
        // Pin the exact distribution so an accidental re-shuffle
        // (e.g. moving IN_FLIGHT under UNCERTAIN) is caught by CI.
        assertThat(distribution.get(PublicOutcome.PENDING))
                .containsExactlyInAnyOrder(State.PENDING,
                        State.IN_FLIGHT, State.RETRYABLE);
        assertThat(distribution.get(PublicOutcome.ACCEPTED))
                .containsExactly(State.CENTRAL_ACCEPTED);
        assertThat(distribution.get(PublicOutcome.REJECTED))
                .containsExactly(State.CENTRAL_REJECTED);
        assertThat(distribution.get(PublicOutcome.UNCERTAIN))
                .containsExactly(State.UNKNOWN_OUTCOME);
        assertThat(distribution.get(PublicOutcome.REVIEW_REQUIRED))
                .containsExactly(State.CONFLICT_REVIEW);
    }
}
