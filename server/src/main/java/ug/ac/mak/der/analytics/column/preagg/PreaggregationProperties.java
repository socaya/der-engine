package ug.ac.mak.der.analytics.column.preagg;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Operator knobs for the Gate 8 preaggregation proposer (SRS
 * FR-INC-013). The feature ships behind {@link #enabled}, default
 * false — SRS Gate 8 requires all self-optimising behaviour to be
 * "behind reversible feature flags".
 *
 * @param enabled                when false, {@link PreaggregationProposer}
 *                               returns an empty list regardless of
 *                               workload
 * @param maxActiveProposals     per-pass cap on proposals
 * @param maxEstimatedBytes      per-pass cumulative byte ceiling
 * @param minScoreThreshold      shapes with lower observations × avg ms
 *                               are ignored
 * @param estimatedBytesPerRow   rough size constant used to project how
 *                               much disk a materialised shape would
 *                               cost; deliberately coarse — refined once
 *                               real segments are produced
 */
@ConfigurationProperties(prefix = "der.analytics.preagg")
public record PreaggregationProperties(
        boolean enabled,
        int maxActiveProposals,
        long maxEstimatedBytes,
        double minScoreThreshold,
        long estimatedBytesPerRow) {

    public PreaggregationProperties {
        if (maxActiveProposals <= 0) {
            maxActiveProposals = 16;
        }
        if (maxEstimatedBytes <= 0L) {
            maxEstimatedBytes = 512L * 1024L * 1024L;
        }
        if (minScoreThreshold < 0.0 || Double.isNaN(minScoreThreshold)) {
            minScoreThreshold = 100.0;
        }
        if (estimatedBytesPerRow <= 0L) {
            estimatedBytesPerRow = 64L;
        }
    }

    public MaterialisationBudget budget() {
        return new MaterialisationBudget(
                maxActiveProposals, maxEstimatedBytes, minScoreThreshold);
    }
}
