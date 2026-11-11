package ug.ac.mak.der.analytics.distributed;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Tunables for the server-side site consolidator (SRS FR-DIS-004).
 * The expected-sites list is the canonical roster — any site in
 * the list that hasn't produced a packet for a cell is explicitly
 * reported as missing. Staleness picks up sites whose freshest
 * packet pre-dates the threshold.
 */
@ConfigurationProperties(prefix = "der.analytics.consolidator")
public record ConsolidatorProperties(
        List<String> expectedSites,
        long stalenessThresholdMinutes) {

    public ConsolidatorProperties {
        expectedSites = expectedSites == null
                ? List.of() : List.copyOf(expectedSites);
        if (stalenessThresholdMinutes <= 0) {
            stalenessThresholdMinutes = 60L * 24L;
        }
    }

    public Duration stalenessThreshold() {
        return Duration.ofMinutes(stalenessThresholdMinutes);
    }
}
