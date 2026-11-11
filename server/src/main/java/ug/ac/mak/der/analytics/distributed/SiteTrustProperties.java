package ug.ac.mak.der.analytics.distributed;

import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Signed-transport trust configuration (SRS FR-DIS-002 "exchange
 * signed site contributions"). Keyed on {@code siteId} → base64
 * shared secret for HMAC-SHA256. A receiver rejects any packet
 * whose signature doesn't verify under the sending site's key.
 *
 * <p>Set {@code localSecret} on each site so it can sign its own
 * packets. Set {@code siteKeys} on every consolidator so it can
 * verify every expected sender.</p>
 *
 * <p>Asymmetric Ed25519 keys land in a follow-up slice; the HMAC
 * scheme here keeps the stdlib dependency surface tight and still
 * defends against the "forged packet" threat.</p>
 */
@ConfigurationProperties(prefix = "der.analytics.trust")
public record SiteTrustProperties(
        String localSecret,
        Map<String, String> siteKeys,
        boolean rejectUnsigned) {

    public SiteTrustProperties {
        siteKeys = siteKeys == null ? Map.of() : Map.copyOf(siteKeys);
    }
}
