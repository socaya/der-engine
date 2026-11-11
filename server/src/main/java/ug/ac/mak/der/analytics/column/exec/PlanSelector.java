package ug.ac.mak.der.analytics.column.exec;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.column.manifest.Manifest;
import ug.ac.mak.der.analytics.column.manifest.ManifestReader;
import ug.ac.mak.der.analytics.column.manifest.ManifestStore;
import ug.ac.mak.der.analytics.column.manifest.ManifestWriter;
import ug.ac.mak.der.analytics.column.manifest.SegmentRef;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarProperties;
import ug.ac.mak.der.analytics.column.stats.PlanCoster;
import ug.ac.mak.der.analytics.column.stats.SegmentStatistics;
import ug.ac.mak.der.analytics.column.stats.SegmentStatisticsStore;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * SRS FR-QRY-004 plan selection. Given a query, picks the cheaper
 * of the two candidate execution engines:
 *
 * <ul>
 *   <li>{@link Engine#COLUMNAR} — scans the current manifest's
 *       segments, per-segment cost from {@link PlanCoster}.</li>
 *   <li>{@link Engine#ROW_STORE} — defers to Postgres
 *       {@code analytics_cell}; cost approximated as row count
 *       × per-row scan factor.</li>
 * </ul>
 *
 * <p>The columnar plan is only chosen when:</p>
 * <ol>
 *   <li>A manifest is published (otherwise no segments exist);</li>
 *   <li>The manifest is fresh — within the configured staleness
 *       threshold vs. the row-store's latest cell mutation;</li>
 *   <li>Its cost estimate is lower than the row-store's.</li>
 * </ol>
 *
 * <p>Always-row-store is a conservative default — the operator
 * sees the trade-off via {@link PlanDecision#rationale()} and can
 * force a flush to swing the next decision.</p>
 */
@Service
public class PlanSelector {

    /** Abstract cost multiplier per row in the row-store. Postgres
     *  COUNT + filter on an indexed PK pair is cheap; tuning
     *  constant for Gate 5 benchmark pass. */
    public static final double ROW_STORE_COST_PER_ROW = 1.0;
    /** Fixed open cost for the row-store (query planner + index
     *  seek). */
    public static final double ROW_STORE_FIXED_COST = 128.0;

    private final AnalyticsColumnarProperties properties;
    private final AnalyticsEngineRepository rowStore;
    private final ObjectMapper json;

    public PlanSelector(final AnalyticsColumnarProperties properties,
                          final AnalyticsEngineRepository rowStore,
                          final ObjectMapper json) {
        this.properties = Objects.requireNonNull(properties, "properties");
        this.rowStore = Objects.requireNonNull(rowStore, "rowStore");
        this.json = Objects.requireNonNull(json, "json");
    }

    public enum Engine { COLUMNAR, ROW_STORE }

    public record PlanDecision(
            Engine selected,
            double columnarCost,
            double rowStoreCost,
            int columnarSegments,
            int rowStoreRows,
            Long manifestGeneration,
            Instant manifestCreatedAt,
            boolean manifestStale,
            String rationale) {
    }

    public PlanDecision select(
            final AnalyticsEngineRepository.CellQuery q)
            throws IOException {
        Objects.requireNonNull(q, "query");
        final List<ug.ac.mak.der.analytics.engine.AnalyticsCell> rowRows =
                rowStore.queryCells(q);
        final int rowCount = rowRows.size();
        final double rowCost = ROW_STORE_FIXED_COST
                + rowCount * ROW_STORE_COST_PER_ROW;

        final Path root = properties.rootPathResolved();
        if (!Files.isDirectory(root)) {
            return new PlanDecision(Engine.ROW_STORE,
                    Double.POSITIVE_INFINITY, rowCost,
                    0, rowCount, null, null, false,
                    "no columnar store on disk");
        }
        final ManifestStore store = new ManifestStore(root,
                new ManifestReader(json), new ManifestWriter(json));
        final Optional<Manifest> opt = store.currentGeneration();
        if (opt.isEmpty()) {
            return new PlanDecision(Engine.ROW_STORE,
                    Double.POSITIVE_INFINITY, rowCost,
                    0, rowCount, null, null, false,
                    "no manifest published");
        }
        final Manifest manifest = opt.get();

        // Stale check — the manifest's createdAt should be newer
        // than the oldest row-store contribution the query would
        // touch. For Gate 4.3 we use a simple heuristic: the
        // manifest is stale when a row-store query returns rows
        // that post-date the manifest.
        boolean stale = false;
        for (final var r : rowRows) {
            if (r.freshnessAt() != null
                    && r.freshnessAt().isAfter(manifest.createdAt())) {
                stale = true;
                break;
            }
        }
        if (stale) {
            return new PlanDecision(Engine.ROW_STORE,
                    Double.POSITIVE_INFINITY, rowCost,
                    manifest.segments().size(), rowCount,
                    manifest.generation(), manifest.createdAt(), true,
                    "manifest stale — row-store has newer cells");
        }

        // Compute columnar cost — iterate matching segments.
        final SegmentStatisticsStore statsStore =
                new SegmentStatisticsStore(json);
        double columnarCost = 0.0;
        int matched = 0;
        for (final SegmentRef ref : manifest.segments()) {
            if (!segmentMatches(ref, q)) {
                continue;
            }
            matched++;
            Optional<SegmentStatistics> statsOpt = Optional.empty();
            try {
                statsOpt = statsStore.read(root.resolve(ref.file()));
            } catch (IOException ignored) {
                // Fall back to selectivity = 1.
            }
            final PlanCoster.CostEstimate est = PlanCoster.estimate(
                    ref, statsOpt, q);
            columnarCost += est.totalCost();
        }
        if (matched == 0) {
            return new PlanDecision(Engine.ROW_STORE,
                    columnarCost, rowCost,
                    0, rowCount,
                    manifest.generation(), manifest.createdAt(), false,
                    "no columnar segments match");
        }
        final Engine pick = columnarCost <= rowCost
                ? Engine.COLUMNAR : Engine.ROW_STORE;
        final String rationale = pick == Engine.COLUMNAR
                ? "columnar cost " + Math.round(columnarCost)
                  + " <= row-store cost " + Math.round(rowCost)
                : "row-store cost " + Math.round(rowCost)
                  + " < columnar cost " + Math.round(columnarCost);
        return new PlanDecision(pick, columnarCost, rowCost,
                matched, rowCount,
                manifest.generation(), manifest.createdAt(), false,
                rationale);
    }

    private static boolean segmentMatches(final SegmentRef ref,
                                             final AnalyticsEngineRepository
                                                     .CellQuery q) {
        if (q.metricIds() != null && !q.metricIds().isEmpty()
                && !q.metricIds().contains(ref.metricId())) {
            return false;
        }
        if (q.periodKeys() != null && !q.periodKeys().isEmpty()
                && !q.periodKeys().contains(ref.periodKey())) {
            return false;
        }
        return true;
    }

    /** Helper used by tests when they want to assert "columnar
     *  would be cheaper" without going through disk. */
    public static Engine pick(final double columnarCost,
                                 final double rowStoreCost) {
        return columnarCost <= rowStoreCost
                ? Engine.COLUMNAR : Engine.ROW_STORE;
    }

    @SuppressWarnings("unused")
    private static boolean olderThan(final Instant a, final Instant b,
                                        final Duration tolerance) {
        return a.isBefore(b.minus(tolerance));
    }

    @SuppressWarnings("unused")
    private static Map<String, Object> placeholder() {
        return Map.of();
    }
}
