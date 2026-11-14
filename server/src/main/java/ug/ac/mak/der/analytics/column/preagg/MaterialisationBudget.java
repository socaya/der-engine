package ug.ac.mak.der.analytics.column.preagg;

/**
 * Operator-controlled ceiling on what the proposer may suggest in one
 * pass (SRS FR-INC-013 "administrator policy controls materialization
 * budgets"). Enforced by {@link PreaggregationProposer}.
 *
 * @param maxActiveProposals  maximum proposals returned per pass
 * @param maxEstimatedBytes   maximum cumulative estimated bytes across
 *                            the returned proposals
 * @param minScoreThreshold   shapes below this score are not proposed
 *                            regardless of budget headroom
 */
public record MaterialisationBudget(
        int maxActiveProposals,
        long maxEstimatedBytes,
        double minScoreThreshold) {

    public MaterialisationBudget {
        if (maxActiveProposals < 0) {
            throw new IllegalArgumentException(
                    "maxActiveProposals must be non-negative");
        }
        if (maxEstimatedBytes < 0L) {
            throw new IllegalArgumentException(
                    "maxEstimatedBytes must be non-negative");
        }
        if (minScoreThreshold < 0.0 || Double.isNaN(minScoreThreshold)) {
            throw new IllegalArgumentException(
                    "minScoreThreshold must be finite and non-negative");
        }
    }

    public static MaterialisationBudget defaults() {
        return new MaterialisationBudget(16, 512L * 1024L * 1024L, 100.0);
    }
}
