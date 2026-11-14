package ug.ac.mak.der.analytics.column.preagg;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.column.feedback.PlanFeedback;
import ug.ac.mak.der.analytics.column.feedback.WorkloadStatsProperties;
import ug.ac.mak.der.analytics.column.feedback.WorkloadStatsStore;

class PreaggregationProposerTest {

    private WorkloadStatsStore freshStats() {
        return new WorkloadStatsStore(new WorkloadStatsProperties(64));
    }

    private PreaggregationProperties props(final boolean enabled,
                                              final double minScore,
                                              final long maxBytes,
                                              final int maxProposals,
                                              final long bytesPerRow) {
        return new PreaggregationProperties(
                enabled, maxProposals, maxBytes, minScore, bytesPerRow);
    }

    private PreaggregationProperties defaults(final boolean enabled) {
        return props(enabled, 100.0, 1_000_000L, 16, 64L);
    }

    private PlanFeedback obs(final String shape,
                                final long elapsed,
                                final long actualRows,
                                final Instant at) {
        return new PlanFeedback(at, "columnar", shape,
                100L, actualRows, 100.0, elapsed);
    }

    @Test
    void disabledFlagReturnsEmpty() {
        final WorkloadStatsStore stats = freshStats();
        for (int i = 0; i < 10; i++) {
            stats.observe(obs("s1", 100L, 10L, Instant.now()));
        }
        final var proposer = new PreaggregationProposer(stats, defaults(false));
        assertThat(proposer.propose()).isEmpty();
    }

    @Test
    void enabledFlagProducesProposalsRankedByScore() {
        final WorkloadStatsStore stats = freshStats();
        final Instant now = Instant.now();
        // s-low: 2 obs × 10ms = score 20 (below threshold 100)
        for (int i = 0; i < 2; i++) {
            stats.observe(obs("s-low", 10L, 5L, now));
        }
        // s-mid: 10 obs × 50ms = score 500
        for (int i = 0; i < 10; i++) {
            stats.observe(obs("s-mid", 50L, 20L, now));
        }
        // s-high: 20 obs × 100ms = score 2000
        for (int i = 0; i < 20; i++) {
            stats.observe(obs("s-high", 100L, 30L, now));
        }
        final var proposer = new PreaggregationProposer(stats, defaults(true));
        final List<PreaggregationProposal> ps = proposer.propose();
        assertThat(ps).hasSize(2);
        assertThat(ps.get(0).shapeKey()).isEqualTo("s-high");
        assertThat(ps.get(1).shapeKey()).isEqualTo("s-mid");
        assertThat(ps.get(0).score()).isGreaterThan(ps.get(1).score());
    }

    @Test
    void shapesBelowMinScoreAreDropped() {
        final WorkloadStatsStore stats = freshStats();
        // Score = 1 × 50 = 50 (below default threshold 100).
        stats.observe(obs("s1", 50L, 10L, Instant.now()));
        final var proposer = new PreaggregationProposer(stats, defaults(true));
        assertThat(proposer.propose()).isEmpty();
    }

    @Test
    void maxActiveProposalsCaps() {
        final WorkloadStatsStore stats = freshStats();
        final Instant now = Instant.now();
        for (int shape = 0; shape < 5; shape++) {
            for (int i = 0; i < 10; i++) {
                stats.observe(obs("s" + shape, 100L, 10L, now));
            }
        }
        final PreaggregationProperties p = props(true,
                100.0, 1_000_000L, 2, 64L);
        final List<PreaggregationProposal> ps =
                new PreaggregationProposer(stats, p).propose();
        assertThat(ps).hasSize(2);
    }

    @Test
    void byteBudgetSkipsOversizeCandidatesButKeepsFitting() {
        final WorkloadStatsStore stats = freshStats();
        final Instant now = Instant.now();
        // s-big: avgActualRows = 1000 → 64_000 bytes projected.
        for (int i = 0; i < 20; i++) {
            stats.observe(obs("s-big", 100L, 1_000L, now));
        }
        // s-small: avgActualRows = 10 → 640 bytes projected, score 1500.
        for (int i = 0; i < 15; i++) {
            stats.observe(obs("s-small", 100L, 10L, now));
        }
        // Budget 2000 bytes: s-big (64000) exceeds alone → skipped;
        // s-small (640) fits, so we still get one proposal.
        final PreaggregationProperties p = props(true,
                100.0, 2_000L, 16, 64L);
        final List<PreaggregationProposal> ps =
                new PreaggregationProposer(stats, p).propose();
        assertThat(ps).hasSize(1);
        assertThat(ps.get(0).shapeKey()).isEqualTo("s-small");
    }

    @Test
    void byteBudgetAccumulatesUntilExhausted() {
        final WorkloadStatsStore stats = freshStats();
        final Instant now = Instant.now();
        // Three shapes, each projects 640 bytes (10 rows × 64/row).
        for (int shape = 0; shape < 3; shape++) {
            for (int i = 0; i < 20 - shape; i++) {
                stats.observe(obs("s" + shape, 100L, 10L, now));
            }
        }
        // Budget fits exactly two 640-byte proposals.
        final PreaggregationProperties p = props(true,
                100.0, 1_280L, 16, 64L);
        final List<PreaggregationProposal> ps =
                new PreaggregationProposer(stats, p).propose();
        assertThat(ps).hasSize(2);
    }

    @Test
    void rationaleMentionsObservationsAndAvgLatency() {
        final WorkloadStatsStore stats = freshStats();
        for (int i = 0; i < 10; i++) {
            stats.observe(obs("s1", 50L, 20L, Instant.now()));
        }
        final List<PreaggregationProposal> ps =
                new PreaggregationProposer(stats, defaults(true)).propose();
        assertThat(ps).hasSize(1);
        assertThat(ps.get(0).rationale())
                .contains("10")
                .contains("50");
    }

    @Test
    void estimatedBytesIsAtLeastOneRowWorth() {
        final WorkloadStatsStore stats = freshStats();
        // Single observation, actualRows=0 → estimator floors to 1 row.
        for (int i = 0; i < 20; i++) {
            stats.observe(obs("s1", 200L, 0L, Instant.now()));
        }
        final List<PreaggregationProposal> ps =
                new PreaggregationProposer(stats, defaults(true)).propose();
        assertThat(ps).hasSize(1);
        assertThat(ps.get(0).estimatedBytes()).isEqualTo(64L);
    }
}
