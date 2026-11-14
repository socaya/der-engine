package ug.ac.mak.der.analytics.column.preagg;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.column.feedback.WorkloadShapeStats;
import ug.ac.mak.der.analytics.column.feedback.WorkloadStatsStore;

/**
 * Ranks observed query shapes and emits advisory preaggregation
 * proposals under an administrator-controlled budget (SRS FR-INC-013).
 *
 * <p>This slice (Gate 8.2) produces advisory proposal objects only.
 * Persistence, state transitions, and admin approval land in slice 8.3
 * — the proposer's job here is just to answer "if we were to spend
 * budget right now, which shapes should we materialise?"</p>
 *
 * <p>Semantics are never altered by auto-propose: proposals are
 * candidates for a human (or AUTO_APPROVE policy) to accept later,
 * not an instruction to the executor. Keeps the SRS Gate 8 guardrail:
 * <em>"Never allow automatic decisions to alter query semantics."</em></p>
 */
@Service
public class PreaggregationProposer {

    private final WorkloadStatsStore workloadStats;
    private final PreaggregationProperties properties;

    public PreaggregationProposer(
            final WorkloadStatsStore workloadStats,
            final PreaggregationProperties properties) {
        this.workloadStats = Objects.requireNonNull(
                workloadStats, "workloadStats");
        this.properties = Objects.requireNonNull(
                properties, "properties");
    }

    /** Propose using the globally configured properties. */
    public List<PreaggregationProposal> propose() {
        if (!properties.enabled()) {
            return List.of();
        }
        return propose(properties.budget());
    }

    /** Propose under a caller-supplied budget. Used by tests and by
     *  future admin overrides of the configured defaults. */
    public List<PreaggregationProposal> propose(
            final MaterialisationBudget budget) {
        Objects.requireNonNull(budget, "budget");
        if (budget.maxActiveProposals() == 0) {
            return List.of();
        }
        final List<WorkloadShapeStats> candidates =
                workloadStats.top(Math.max(1, budget.maxActiveProposals() * 4));
        final List<PreaggregationProposal> out =
                new ArrayList<>(budget.maxActiveProposals());
        long bytesUsed = 0L;
        for (final WorkloadShapeStats s : candidates) {
            if (out.size() >= budget.maxActiveProposals()) {
                break;
            }
            if (s.score() < budget.minScoreThreshold()) {
                break;
            }
            final long projected = estimateBytes(s);
            if (bytesUsed + projected > budget.maxEstimatedBytes()) {
                continue;
            }
            bytesUsed += projected;
            out.add(new PreaggregationProposal(
                    s.shapeKey(),
                    s.observations(),
                    s.avgElapsedMillis(),
                    s.score(),
                    projected,
                    s.firstObservedAt(),
                    s.lastObservedAt(),
                    rationaleFor(s)));
        }
        return out;
    }

    private long estimateBytes(final WorkloadShapeStats s) {
        final long rows = Math.max(1L, s.avgActualRows());
        return rows * properties.estimatedBytesPerRow();
    }

    private static String rationaleFor(final WorkloadShapeStats s) {
        return String.format(Locale.ROOT,
                "observed %d× avg %.1fms (score=%.1f)",
                s.observations(), s.avgElapsedMillis(), s.score());
    }
}
