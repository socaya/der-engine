package ug.ac.mak.der.analytics.distributed;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;

/**
 * SRS FR-DIS-002 / FR-DIS-004 consolidator. Groups accepted site
 * packets by cell coordinate and merges them under algebra-safe
 * aggregation. Completeness attribution surfaces which sites are
 * missing (never reported) and which are stale (freshest packet
 * older than threshold) so a consumer never mistakes partial
 * data for complete.
 *
 * <p>Distinct-count metrics are deliberately absent (FR-DIS-005).
 * The merge operates on count / sum / min / max / numerator /
 * denominator — anything that composes under set union with no
 * global-identity assumption.</p>
 */
@Service
public class SiteConsolidator {

    private final SiteContributionRepository repo;
    private final ConsolidatorProperties properties;

    public SiteConsolidator(final SiteContributionRepository repo,
                              final ConsolidatorProperties properties) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.properties = Objects.requireNonNull(properties, "properties");
    }

    public record ConsolidateRequest(
            List<UUID> metricIds,
            List<String> periodKeys,
            int limit) {
    }

    public List<ConsolidatedCell> consolidate(
            final ConsolidateRequest request) {
        Objects.requireNonNull(request, "request");
        final int limit = request.limit() <= 0
                ? 2000 : Math.min(request.limit(), 10_000);
        final List<SiteContributionPacket> packets = repo.findForQuery(
                request.metricIds() == null ? List.of()
                        : request.metricIds(),
                request.periodKeys() == null ? List.of()
                        : request.periodKeys(),
                limit);
        if (packets.isEmpty()) {
            return List.of();
        }

        final Map<CellKey, List<SiteContributionPacket>> grouped =
                new LinkedHashMap<>();
        for (final SiteContributionPacket p : packets) {
            grouped.computeIfAbsent(
                    new CellKey(p.metricId(), p.definitionVersion(),
                            p.periodKey(), p.orgUnitUid(),
                            p.dimensionKey()),
                    k -> new ArrayList<>()).add(p);
        }

        final Instant now = Instant.now();
        final Instant staleCutoff = now.minus(
                properties.stalenessThreshold());
        // Preserve the operator-supplied order so the missingSites
        // list is stable across runs (admin UI relies on it).
        final List<String> expected = List.copyOf(
                properties.expectedSites());
        final List<ConsolidatedCell> out = new ArrayList<>(grouped.size());
        for (final Map.Entry<CellKey, List<SiteContributionPacket>> e
                : grouped.entrySet()) {
            out.add(merge(e.getKey(), e.getValue(), expected,
                    staleCutoff));
        }
        return out;
    }

    private static ConsolidatedCell merge(final CellKey key,
                                             final List<SiteContributionPacket>
                                                     packets,
                                             final List<String> expected,
                                             final Instant staleCutoff) {
        long totalCount = 0L;
        BigDecimal totalSum = null;
        BigDecimal mergedMin = null;
        BigDecimal mergedMax = null;
        BigDecimal totalNum = null;
        BigDecimal totalDen = null;
        Instant oldest = null;
        Instant newest = null;
        final Set<String> reporting = new java.util.LinkedHashSet<>();
        final Set<String> stale = new java.util.LinkedHashSet<>();
        // When multiple packets from the same site exist (different
        // source_cursor values), only the newest produced_at
        // contributes — older packets have been superseded.
        final Map<String, SiteContributionPacket> newestPerSite =
                new LinkedHashMap<>();
        for (final SiteContributionPacket p : packets) {
            final SiteContributionPacket existing = newestPerSite
                    .get(p.siteId());
            if (existing == null
                    || p.producedAt().isAfter(existing.producedAt())) {
                newestPerSite.put(p.siteId(), p);
            }
        }
        for (final SiteContributionPacket p : newestPerSite.values()) {
            totalCount += p.count();
            totalSum = addDecimal(totalSum, p.sum());
            mergedMin = minDecimal(mergedMin, p.min());
            mergedMax = maxDecimal(mergedMax, p.max());
            totalNum = addDecimal(totalNum, p.numerator());
            totalDen = addDecimal(totalDen, p.denominator());
            if (oldest == null || p.producedAt().isBefore(oldest)) {
                oldest = p.producedAt();
            }
            if (newest == null || p.producedAt().isAfter(newest)) {
                newest = p.producedAt();
            }
            reporting.add(p.siteId());
            if (p.producedAt().isBefore(staleCutoff)) {
                stale.add(p.siteId());
            }
        }
        final List<String> missing = new ArrayList<>();
        for (final String s : expected) {
            if (!reporting.contains(s)) {
                missing.add(s);
            }
        }
        final double denom = expected.isEmpty()
                ? reporting.size() : expected.size();
        final double completeness = denom == 0.0 ? 1.0
                : (double) reporting.size() / denom;
        return new ConsolidatedCell(
                key.metricId(), key.definitionVersion(),
                key.periodKey(), key.orgUnitUid(), key.dimensionKey(),
                totalCount, totalSum, mergedMin, mergedMax,
                totalNum, totalDen,
                new ArrayList<>(reporting), missing,
                new ArrayList<>(stale),
                oldest, newest,
                Math.min(1.0, completeness));
    }

    private static BigDecimal addDecimal(final BigDecimal a,
                                            final BigDecimal b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.add(b);
    }

    private static BigDecimal minDecimal(final BigDecimal a,
                                            final BigDecimal b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.compareTo(b) < 0 ? a : b;
    }

    private static BigDecimal maxDecimal(final BigDecimal a,
                                            final BigDecimal b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.compareTo(b) > 0 ? a : b;
    }

    private record CellKey(UUID metricId, int definitionVersion,
                             String periodKey, String orgUnitUid,
                             String dimensionKey) {
    }
}
