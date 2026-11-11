package ug.ac.mak.der.analytics.distributed;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Signed, versioned contribution one site publishes upstream so a
 * server-side consolidator can merge it into the central roll-up
 * (SRS FR-DIS-002). The packet is designed around <em>algebra-
 * safe</em> aggregates — count + sum + min + max + numerator +
 * denominator — so the receiver can combine packets across sites
 * without re-reading source rows.
 *
 * <p>Cross-site distinct counts are deliberately absent (SRS
 * FR-DIS-005): without a global identity scheme the merge would
 * silently double-count, so distinct metrics must stay site-
 * local.</p>
 *
 * @param siteId         DER device UID the packet was produced by
 * @param packetId       random UUID; the receiver's dedup key
 * @param metricId       analytics_definition.id
 * @param definitionVersion metric version frozen at produce time
 * @param periodKey      reporting period
 * @param orgUnitUid     the authoritative org unit for this cell
 * @param dimensionKey   sorted name=value|... key; "" for scalar
 *                       metrics
 * @param count          number of eligible source contributions
 * @param sum            sum of contribution_value
 * @param min            minimum observed contribution_value
 * @param max            maximum observed contribution_value
 * @param numerator      sum of numerator contributions (ratio
 *                       indicators)
 * @param denominator    sum of denominator contributions
 * @param sourceCursor   cursor from analytics_source_cursor at
 *                       produce time; receiver uses this to
 *                       detect retracted vs forward-progress
 *                       packets
 * @param producedAt     wall-clock stamp at produce time
 * @param checksumHex    sha-256 over the canonical bytes; receiver
 *                       verifies before merging
 * @param signatureHex   detached signature (format-opaque for now;
 *                       Gate 6.4 wires the transport trust layer)
 */
public record SiteContributionPacket(
        String siteId,
        UUID packetId,
        UUID metricId,
        int definitionVersion,
        String periodKey,
        String orgUnitUid,
        String dimensionKey,
        long count,
        BigDecimal sum,
        BigDecimal min,
        BigDecimal max,
        BigDecimal numerator,
        BigDecimal denominator,
        long sourceCursor,
        Instant producedAt,
        String checksumHex,
        String signatureHex) {

    public SiteContributionPacket {
        Objects.requireNonNull(siteId, "siteId");
        Objects.requireNonNull(packetId, "packetId");
        Objects.requireNonNull(metricId, "metricId");
        Objects.requireNonNull(periodKey, "periodKey");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(producedAt, "producedAt");
        dimensionKey = dimensionKey == null ? "" : dimensionKey;
        if (count < 0L) {
            throw new IllegalArgumentException(
                    "count must be non-negative");
        }
    }
}
