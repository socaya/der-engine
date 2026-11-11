package ug.ac.mak.der.analytics.distributed;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsContributionRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * SRS FR-DIS-002 contribution exporter. Walks the current
 * materialised cells and emits a signed packet per cell so a
 * server-side consolidator can merge them across sites without
 * re-reading source rows.
 *
 * <p>Carries algebra-safe aggregates only — count / sum / min /
 * max / numerator / denominator — never distinct counts (SRS
 * FR-DIS-005). The receiver side lands in Gate 6.2.</p>
 */
@Service
public class SiteContributionExporter {

    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsContributionRepository contributions;
    private final String siteId;
    private SiteSigner signer;

    public SiteContributionExporter(
            final AnalyticsEngineRepository engineRepo,
            final AnalyticsContributionRepository contributions,
            @Value("${der.analytics.site.id:}") final String siteIdProperty) {
        this.engineRepo = Objects.requireNonNull(engineRepo, "engineRepo");
        this.contributions = Objects.requireNonNull(contributions,
                "contributions");
        this.siteId = (siteIdProperty == null || siteIdProperty.isBlank())
                ? "der-local" : siteIdProperty;
    }

    /** Setter injection — keeps the 3-arg constructor compatible
     *  with pre-Gate-6.4 tests that don't need a signer. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setSigner(final SiteSigner signer) {
        this.signer = signer;
    }

    public record ExportRequest(
            List<UUID> metricIds,
            List<String> periodKeys,
            List<String> orgUnits,
            Long sinceCursor,
            int limit) {
    }

    public record ExportResult(
            String siteId,
            int cellsScanned,
            int packetsEmitted,
            long maxSourceCursor,
            Instant producedAt,
            List<SiteContributionPacket> packets) {
    }

    public ExportResult export(final ExportRequest request) {
        Objects.requireNonNull(request, "request");
        final int limit = request.limit() <= 0
                ? 2000 : Math.min(request.limit(), 5000);
        final AnalyticsEngineRepository.CellQuery q =
                new AnalyticsEngineRepository.CellQuery(
                        request.metricIds() == null
                                ? List.of() : request.metricIds(),
                        request.periodKeys() == null
                                ? List.of() : request.periodKeys(),
                        request.orgUnits() == null
                                ? List.of() : request.orgUnits(),
                        Map.of(), limit, 0);
        final List<AnalyticsCell> cells = engineRepo.queryCells(q);

        final List<SiteContributionPacket> packets =
                new ArrayList<>(cells.size());
        long maxCursor = 0L;
        final Instant producedAt = Instant.now();
        for (final AnalyticsCell c : cells) {
            final AnalyticsContributionRepository.CellAggregate agg =
                    contributions.aggregateForCell(c.metricId(),
                            c.definitionVersion(), c.periodKey(),
                            c.orgUnitUid(),
                            c.dimensionKey() == null ? "" : c.dimensionKey());
            final long cursor = Math.max(1L, agg.count());
            if (cursor > maxCursor) {
                maxCursor = cursor;
            }
            // Dedup / forward-progress gate per spec: skip cells whose
            // accumulated cursor is at or below the caller's cutoff.
            if (request.sinceCursor() != null
                    && cursor <= request.sinceCursor()) {
                continue;
            }
            final UUID packetId = UUID.randomUUID();
            final String checksum = checksum(c, agg, cursor, producedAt);
            final String signature = signer == null
                    ? null : signer.sign(checksum);
            packets.add(new SiteContributionPacket(
                    siteId, packetId,
                    c.metricId(), c.definitionVersion(),
                    c.periodKey(), c.orgUnitUid(),
                    c.dimensionKey() == null ? "" : c.dimensionKey(),
                    agg.count(), agg.sum(),
                    agg.min(), agg.max(),
                    agg.sumNumerator(), agg.sumDenominator(),
                    cursor, producedAt,
                    checksum, signature));
        }
        return new ExportResult(siteId, cells.size(), packets.size(),
                maxCursor, producedAt, packets);
    }

    public String siteId() {
        return siteId;
    }

    /** SHA-256 over the canonical packet bytes. Receiver recomputes
     *  and rejects on mismatch (SRS FR-DIS-006 integrity
     *  verification). Signature + transport trust land in Gate 6.4. */
    private static String checksum(final AnalyticsCell c,
                                      final AnalyticsContributionRepository
                                              .CellAggregate agg,
                                      final long cursor,
                                      final Instant producedAt) {
        try {
            final MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(c.metricId().toString()
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(Integer.toString(c.definitionVersion())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(c.periodKey().getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(c.orgUnitUid().getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update((c.dimensionKey() == null ? "" : c.dimensionKey())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(Long.toString(agg.count())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(agg.sum()).getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(agg.min()).getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(agg.max()).getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(agg.sumNumerator())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(agg.sumDenominator())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(Long.toString(cursor)
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(producedAt.toString()
                    .getBytes(StandardCharsets.UTF_8));
            final byte[] digest = md.digest();
            final StringBuilder sb = new StringBuilder(digest.length * 2);
            for (final byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(
                    "SHA-256 unavailable on this JVM", ex);
        }
    }

    private static String plain(final BigDecimal v) {
        return v == null ? "" : v.toPlainString();
    }
}
