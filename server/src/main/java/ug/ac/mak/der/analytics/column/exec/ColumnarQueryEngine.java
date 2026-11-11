package ug.ac.mak.der.analytics.column.exec;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.column.ColumnBatch;
import ug.ac.mak.der.analytics.column.manifest.Manifest;
import ug.ac.mak.der.analytics.column.manifest.ManifestReader;
import ug.ac.mak.der.analytics.column.manifest.ManifestStore;
import ug.ac.mak.der.analytics.column.manifest.ManifestWriter;
import ug.ac.mak.der.analytics.column.manifest.SegmentRef;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarProperties;
import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * SRS §6 end-to-end columnar query path. Answers an
 * {@link AnalyticsEngineRepository.CellQuery} by reading the
 * current manifest, projection-loading only the columns the
 * caller needs, applying filter predicates vectorised, and
 * materialising the surviving rows back as {@link AnalyticsCell}
 * — the same shape the row-store returns. The result is
 * oracle-matched by {@code AnalyticsColumnarVerifier} and by the
 * dedicated end-to-end test that runs the same query through both
 * engines.
 */
@Service
public class ColumnarQueryEngine {

    /** Columns the engine always projects from a segment. Matches
     *  the writer's layout in {@code AnalyticsColumnarSink}. */
    private static final List<String> PROJECTED_COLUMNS = List.of(
            "orgUnit", "dimensionKey", "count", "sum", "value",
            "numerator", "denominator", "freshnessAt", "qualityState");

    private final AnalyticsColumnarProperties properties;
    private final ObjectMapper json;

    public ColumnarQueryEngine(
            final AnalyticsColumnarProperties properties,
            final ObjectMapper json) {
        this.properties = Objects.requireNonNull(properties, "properties");
        this.json = Objects.requireNonNull(json, "json");
    }

    public List<AnalyticsCell> query(
            final AnalyticsEngineRepository.CellQuery q)
            throws IOException {
        Objects.requireNonNull(q, "query");
        final Path root = properties.rootPathResolved();
        if (!Files.isDirectory(root)) {
            return List.of();
        }
        final ManifestStore store = new ManifestStore(root,
                new ManifestReader(json), new ManifestWriter(json));
        final Optional<Manifest> opt = store.currentGeneration();
        if (opt.isEmpty()) {
            return List.of();
        }
        final Manifest manifest = opt.get();

        final List<AnalyticsCell> out = new ArrayList<>();
        int emitted = 0;
        final int limit = q.limit() <= 0 ? 2000 : Math.min(q.limit(), 2000);

        for (final SegmentRef ref : manifest.segments()) {
            if (!matchesSegment(ref, q)) {
                continue;
            }
            final Path file = root.resolve(ref.file());
            final ColumnScanner.ScannedSegment scanned =
                    ColumnScanner.load(file, PROJECTED_COLUMNS);
            final Filter filter = buildFilter(q);
            final SelectionBitmap sel = scanned.applyFilter(filter);
            final int[] rows = sel.selectedRows();
            for (final int row : rows) {
                if (emitted >= limit) {
                    break;
                }
                out.add(rowToCell(ref, row, scanned.batches()));
                emitted++;
            }
            if (emitted >= limit) {
                break;
            }
        }
        return out;
    }

    private static boolean matchesSegment(
            final SegmentRef ref,
            final AnalyticsEngineRepository.CellQuery q) {
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

    private static Filter buildFilter(
            final AnalyticsEngineRepository.CellQuery q) {
        final List<Filter> parts = new ArrayList<>();
        if (q.orgUnitUids() != null && !q.orgUnitUids().isEmpty()) {
            final List<Object> vals = new ArrayList<>(q.orgUnitUids());
            parts.add(new Filter.In("orgUnit", vals));
        }
        if (q.dimensionFilter() != null && !q.dimensionFilter().isEmpty()) {
            // Dimension filter is a conjunction of (name=value) pairs
            // encoded into the dimensionKey column's sorted key. For
            // v1 we match the full dimensionKey literal when the
            // caller supplies the same shape; richer predicate
            // lands in Gate 3.5 when the planner can decompose
            // multi-axis matches.
            final List<Object> vals = new ArrayList<>();
            for (final Map.Entry<String, String> e
                    : q.dimensionFilter().entrySet()) {
                vals.add(e.getKey() + "=" + e.getValue());
            }
            if (!vals.isEmpty()) {
                // Match any dimensionKey that contains all required
                // pairs — we approximate "contains" with equality in
                // v1 since dimensionKey is sorted + pipe-delimited.
                parts.add(new Filter.In("dimensionKey", vals));
            }
        }
        if (parts.isEmpty()) {
            return null;
        }
        if (parts.size() == 1) {
            return parts.get(0);
        }
        return new Filter.And(parts);
    }

    private AnalyticsCell rowToCell(final SegmentRef ref,
                                        final int row,
                                        final Map<String, ColumnBatch>
                                                batches) {
        final String ou = ((ColumnBatch.Str) batches.get("orgUnit"))
                .get(row);
        final String dim = ((ColumnBatch.Str) batches.get("dimensionKey"))
                .get(row);
        final ColumnBatch.Int64 count =
                (ColumnBatch.Int64) batches.get("count");
        final ColumnBatch.Decimal sum =
                (ColumnBatch.Decimal) batches.get("sum");
        final ColumnBatch.Decimal value =
                (ColumnBatch.Decimal) batches.get("value");
        final ColumnBatch.Decimal num =
                (ColumnBatch.Decimal) batches.get("numerator");
        final ColumnBatch.Decimal den =
                (ColumnBatch.Decimal) batches.get("denominator");
        final ColumnBatch.Date fresh =
                (ColumnBatch.Date) batches.get("freshnessAt");
        final ColumnBatch.Str quality =
                (ColumnBatch.Str) batches.get("qualityState");

        return new AnalyticsCell(
                ref.metricId(), ref.definitionVersion(),
                ref.periodKey(), ou,
                dim == null ? "" : dim,
                count.nulls().isNull(row) ? null : count.get(row),
                nullableDecimal(sum, row),
                nullableDecimal(value, row),
                nullableDecimal(num, row),
                nullableDecimal(den, row),
                fresh.nulls().isNull(row) ? null
                        : fresh.getLocalDate(row)
                                .atStartOfDay(ZoneOffset.UTC)
                                .toInstant(),
                quality.nulls().isNull(row) ? null : quality.get(row));
    }

    private static BigDecimal nullableDecimal(
            final ColumnBatch.Decimal batch, final int row) {
        if (batch.nulls().isNull(row)) {
            return null;
        }
        return batch.get(row);
    }

    /** Proof that the service is reachable; used by the admin
     *  ping before issuing a real query. */
    public boolean ready() {
        try {
            return currentGeneration().isPresent();
        } catch (IOException ex) {
            return false;
        }
    }

    private Optional<Manifest> currentGeneration() throws IOException {
        final Path root = properties.rootPathResolved();
        if (!Files.isDirectory(root)) {
            return Optional.empty();
        }
        return new ManifestStore(root,
                new ManifestReader(json),
                new ManifestWriter(json)).currentGeneration();
    }

    /** Borrow createdAt — handy for observability. */
    public Optional<Instant> manifestCreatedAt() throws IOException {
        return currentGeneration().map(Manifest::createdAt);
    }
}
