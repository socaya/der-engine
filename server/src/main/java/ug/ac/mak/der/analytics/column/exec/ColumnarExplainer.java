package ug.ac.mak.der.analytics.column.exec;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.column.manifest.Manifest;
import ug.ac.mak.der.analytics.column.manifest.ManifestReader;
import ug.ac.mak.der.analytics.column.manifest.ManifestStore;
import ug.ac.mak.der.analytics.column.manifest.ManifestWriter;
import ug.ac.mak.der.analytics.column.manifest.SegmentRef;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarProperties;
import ug.ac.mak.der.analytics.column.stats.ColumnStatistics;
import ug.ac.mak.der.analytics.column.stats.PlanCoster;
import ug.ac.mak.der.analytics.column.stats.SegmentStatistics;
import ug.ac.mak.der.analytics.column.stats.SegmentStatisticsStore;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * SRS FR-QRY-007 EXPLAIN. Returns the plan a query would execute
 * without actually touching the segments. Lets operators (and the
 * admin UI) see which segments the planner chose, which it
 * skipped and why, and what the estimated row count is.
 *
 * <p>Gate 3.5 is a static-plan EXPLAIN — the cost model lands in
 * Gate 4. Here the "estimate" is just the sum of rowCount across
 * the matching segments; a filter's selectivity is noted but not
 * yet costed.</p>
 */
@Service
public class ColumnarExplainer {

    private final AnalyticsColumnarProperties properties;
    private final ObjectMapper json;

    public ColumnarExplainer(
            final AnalyticsColumnarProperties properties,
            final ObjectMapper json) {
        this.properties = Objects.requireNonNull(properties, "properties");
        this.json = Objects.requireNonNull(json, "json");
    }

    public record SegmentPlan(
            UUID segmentId,
            UUID metricId,
            int definitionVersion,
            String periodKey,
            int rowCount,
            String file,
            String decision,
            double estimatedSelectivity,
            long estimatedRowsOut,
            long estimatedBytesScanned,
            double estimatedCost) {
    }

    public record QueryPlan(
            long generation,
            Instant manifestCreatedAt,
            int segmentsMatched,
            int segmentsSkipped,
            List<SegmentPlan> matched,
            List<SegmentPlan> skipped,
            List<String> projectedColumns,
            String filterDescription,
            int rowLimit,
            int estimatedRows,
            double estimatedTotalCost,
            String engine) {
    }

    private static final List<String> PROJECTED_COLUMNS = List.of(
            "orgUnit", "dimensionKey", "count", "sum", "value",
            "numerator", "denominator", "freshnessAt", "qualityState");

    public QueryPlan explain(
            final AnalyticsEngineRepository.CellQuery q)
            throws IOException {
        Objects.requireNonNull(q, "query");
        final Path root = properties.rootPathResolved();
        if (!Files.isDirectory(root)) {
            return emptyPlan(q, "no columnar store on disk");
        }
        final ManifestStore store = new ManifestStore(root,
                new ManifestReader(json), new ManifestWriter(json));
        final Optional<Manifest> opt = store.currentGeneration();
        if (opt.isEmpty()) {
            return emptyPlan(q, "no manifest published");
        }
        final Manifest manifest = opt.get();

        final List<SegmentPlan> matched = new ArrayList<>();
        final List<SegmentPlan> skipped = new ArrayList<>();
        int estimatedRows = 0;
        double totalCost = 0.0;
        final int limit = q.limit() <= 0 ? 2000 : Math.min(q.limit(), 2000);
        final SegmentStatisticsStore statsStore =
                new SegmentStatisticsStore(json);
        for (final SegmentRef ref : manifest.segments()) {
            String reason = decideSegment(ref, q);
            Optional<SegmentStatistics> statsOpt = Optional.empty();
            if ("matched".equals(reason)) {
                final Path file = root.resolve(ref.file());
                try {
                    statsOpt = statsStore.read(file);
                } catch (IOException ignored) {
                    // No stats sidecar — fall back to matched with
                    // selectivity = 1.0.
                }
                if (statsOpt.isPresent()
                        && q.orgUnitUids() != null
                        && !q.orgUnitUids().isEmpty()) {
                    final ColumnStatistics ou = statsOpt.get()
                            .column("orgUnit");
                    if (ou != null
                            && !canMatchOrgUnit(ou, q.orgUnitUids())) {
                        reason = "skipped: zone map excludes "
                              + "requested orgUnit";
                    }
                }
            }
            final PlanCoster.CostEstimate est = PlanCoster.estimate(
                    ref, statsOpt, q);
            final SegmentPlan plan = new SegmentPlan(
                    ref.segmentId(), ref.metricId(),
                    ref.definitionVersion(), ref.periodKey(),
                    ref.rowCount(), ref.file(), reason,
                    est.selectivity(), est.estimatedRowsOut(),
                    est.bytesScanned(), est.totalCost());
            if ("matched".equals(reason)) {
                matched.add(plan);
                estimatedRows += est.estimatedRowsOut();
                totalCost += est.totalCost();
            } else {
                skipped.add(plan);
            }
        }
        return new QueryPlan(
                manifest.generation(), manifest.createdAt(),
                matched.size(), skipped.size(),
                matched, skipped,
                PROJECTED_COLUMNS,
                describeFilter(q),
                limit,
                Math.min(estimatedRows, limit),
                totalCost,
                "columnar");
    }

    private static boolean canMatchOrgUnit(final ColumnStatistics stats,
                                              final List<String> wanted) {
        if (stats == null || stats.rowCount() == 0) {
            return true;
        }
        if (stats.distinctSampleExhaustive()
                && !stats.distinctSample().isEmpty()) {
            for (final String w : wanted) {
                if (stats.distinctSample().contains(w)) {
                    return true;
                }
            }
            return false;
        }
        final String min = (String) stats.minValue();
        final String max = (String) stats.maxValue();
        if (min == null || max == null) {
            return true;
        }
        for (final String w : wanted) {
            if (w.compareTo(min) >= 0 && w.compareTo(max) <= 0) {
                return true;
            }
        }
        return false;
    }

    private static String decideSegment(
            final SegmentRef ref,
            final AnalyticsEngineRepository.CellQuery q) {
        if (q.metricIds() != null && !q.metricIds().isEmpty()
                && !q.metricIds().contains(ref.metricId())) {
            return "skipped: metricId not in request";
        }
        if (q.periodKeys() != null && !q.periodKeys().isEmpty()
                && !q.periodKeys().contains(ref.periodKey())) {
            return "skipped: periodKey not in request";
        }
        return "matched";
    }

    private static String describeFilter(
            final AnalyticsEngineRepository.CellQuery q) {
        final List<String> parts = new ArrayList<>();
        if (q.orgUnitUids() != null && !q.orgUnitUids().isEmpty()) {
            parts.add("orgUnit IN "
                    + q.orgUnitUids());
        }
        if (q.dimensionFilter() != null
                && !q.dimensionFilter().isEmpty()) {
            parts.add("dimension " + q.dimensionFilter());
        }
        if (parts.isEmpty()) {
            return "<none>";
        }
        return String.join(" AND ", parts);
    }

    private QueryPlan emptyPlan(
            final AnalyticsEngineRepository.CellQuery q,
            final String reason) {
        return new QueryPlan(-1L, null, 0, 0,
                List.of(), List.of(),
                PROJECTED_COLUMNS,
                describeFilter(q),
                q.limit() <= 0 ? 2000 : q.limit(),
                0,
                0.0,
                "columnar (unavailable: " + reason + ")");
    }
}
