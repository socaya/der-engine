package ug.ac.mak.der.analytics.column.governor;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Tunables for the query governor (SRS §6 FR-QRY-011/013/014,
 * §11.4 NFR-OPS-02). Defaults are deliberately conservative so
 * a fresh pilot can't saturate the host; pilots bump via
 * {@code der.analytics.governor.*}.
 */
@ConfigurationProperties(prefix = "der.analytics.governor")
public record GovernorProperties(
        int maxConcurrent,
        long maxDurationMillis,
        long maxBytesPerQuery) {

    public GovernorProperties {
        if (maxConcurrent <= 0) {
            maxConcurrent = 4;
        }
        if (maxDurationMillis <= 0L) {
            maxDurationMillis = 60_000L;
        }
        if (maxBytesPerQuery <= 0L) {
            maxBytesPerQuery = 256L * 1024L * 1024L;
        }
    }
}
