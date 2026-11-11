package ug.ac.mak.der.analytics.distributed;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Algebra-safe merge of every site's packets for one cell
 * coordinate, plus explicit completeness attribution so a
 * downstream consumer can distinguish "all sites reported" from
 * "server has partial data" (SRS FR-DIS-004).
 */
public record ConsolidatedCell(
        UUID metricId,
        int definitionVersion,
        String periodKey,
        String orgUnitUid,
        String dimensionKey,
        long totalCount,
        BigDecimal totalSum,
        BigDecimal mergedMin,
        BigDecimal mergedMax,
        BigDecimal totalNumerator,
        BigDecimal totalDenominator,
        List<String> reportingSites,
        List<String> missingSites,
        List<String> staleSites,
        Instant oldestProducedAt,
        Instant newestProducedAt,
        double completeness) {

    public ConsolidatedCell {
        Objects.requireNonNull(metricId, "metricId");
        Objects.requireNonNull(periodKey, "periodKey");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        dimensionKey = dimensionKey == null ? "" : dimensionKey;
        reportingSites = List.copyOf(
                Objects.requireNonNull(reportingSites, "reportingSites"));
        missingSites = List.copyOf(
                Objects.requireNonNull(missingSites, "missingSites"));
        staleSites = List.copyOf(
                Objects.requireNonNull(staleSites, "staleSites"));
    }
}
