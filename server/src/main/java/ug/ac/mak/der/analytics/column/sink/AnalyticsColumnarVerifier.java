package ug.ac.mak.der.analytics.column.sink;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.column.Codec;
import ug.ac.mak.der.analytics.column.CodecResolver;
import ug.ac.mak.der.analytics.column.ColumnBatch;
import ug.ac.mak.der.analytics.column.manifest.Manifest;
import ug.ac.mak.der.analytics.column.manifest.ManifestReader;
import ug.ac.mak.der.analytics.column.manifest.ManifestStore;
import ug.ac.mak.der.analytics.column.manifest.ManifestWriter;
import ug.ac.mak.der.analytics.column.manifest.SegmentRef;
import ug.ac.mak.der.analytics.column.segment.Segment;
import ug.ac.mak.der.analytics.column.segment.SegmentColumn;
import ug.ac.mak.der.analytics.column.segment.SegmentReader;
import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * SRS §13.1 oracle verification — the columnar engine must match
 * the row-store on every cell it stores. The verifier reads the
 * current manifest, decodes every segment back into
 * {@link AnalyticsCell} shape, and compares row-by-row against
 * the authoritative {@code analytics_cell} table. Any drift is
 * surfaced as a classified {@link Drift} row; zero drift is the
 * evidence that the columnar path is safe to query from (Gate 3).
 */
@Service
public class AnalyticsColumnarVerifier {

    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsColumnarProperties properties;
    private final ObjectMapper json;

    public AnalyticsColumnarVerifier(
            final AnalyticsEngineRepository engineRepo,
            final AnalyticsColumnarProperties properties,
            final ObjectMapper json) {
        this.engineRepo = Objects.requireNonNull(engineRepo, "engineRepo");
        this.properties = Objects.requireNonNull(properties, "properties");
        this.json = Objects.requireNonNull(json, "json");
    }

    public record Drift(
            UUID metricId,
            String periodKey,
            String orgUnitUid,
            String dimensionKey,
            String reason,
            String rowStoreValue,
            String columnStoreValue) { }

    public record VerifyReport(
            long generation,
            int segmentsChecked,
            int rowsChecked,
            int rowsOk,
            int rowsDrifted,
            List<Drift> drifts) { }

    public VerifyReport verify() throws IOException {
        final Path root = properties.rootPathResolved();
        if (!Files.isDirectory(root)) {
            return new VerifyReport(-1, 0, 0, 0, 0, List.of());
        }
        final ManifestStore store = new ManifestStore(root,
                new ManifestReader(json), new ManifestWriter(json));
        final Optional<Manifest> opt = store.currentGeneration();
        if (opt.isEmpty()) {
            return new VerifyReport(-1, 0, 0, 0, 0, List.of());
        }
        return verify(opt.get());
    }

    /** Verify a shadow manifest before it becomes visible to readers. */
    public VerifyReport verify(final Manifest manifest) throws IOException {
        Objects.requireNonNull(manifest, "manifest");
        final Path root = properties.rootPathResolved();

        int segmentsChecked = 0;
        int rowsChecked = 0;
        int rowsOk = 0;
        final List<Drift> drifts = new ArrayList<>();
        final Set<String> columnarKeys = new HashSet<>();

        for (final SegmentRef ref : manifest.segments()) {
            segmentsChecked++;
            final Path file = root.resolve(ref.file());
            final Segment segment = SegmentReader.parseAll(file);
            final Map<String, ColumnBatch> cols = decodeAllColumns(segment);

            // Index row-store cells for this metric + period so a
            // per-row lookup stays O(1).
            final Map<String, AnalyticsCell> indexed = new HashMap<>();
            final List<AnalyticsCell> cells = engineRepo.queryCells(
                    new AnalyticsEngineRepository.CellQuery(
                            List.of(ref.metricId()),
                            List.of(ref.periodKey()),
                            List.of(), Map.of(), 100_000, 0));
            for (final AnalyticsCell c : cells) {
                indexed.put(cellKey(c.orgUnitUid(), c.dimensionKey()),
                        c);
            }

            final ColumnBatch.Str orgUnit =
                    (ColumnBatch.Str) cols.get("orgUnit");
            final ColumnBatch.Str dim =
                    (ColumnBatch.Str) cols.get("dimensionKey");
            final ColumnBatch.Int64 count =
                    (ColumnBatch.Int64) cols.get("count");
            final ColumnBatch.Decimal sum =
                    (ColumnBatch.Decimal) cols.get("sum");
            final ColumnBatch.Decimal value =
                    (ColumnBatch.Decimal) cols.get("value");
            final ColumnBatch.Decimal numerator =
                    (ColumnBatch.Decimal) cols.get("numerator");
            final ColumnBatch.Decimal denominator =
                    (ColumnBatch.Decimal) cols.get("denominator");
            final ColumnBatch.Str quality =
                    (ColumnBatch.Str) cols.get("qualityState");
            for (int i = 0; i < segment.rowCount(); i++) {
                rowsChecked++;
                final String ou = orgUnit.get(i);
                final String dk = dim.get(i);
                columnarKeys.add(fullCellKey(ref.metricId(),
                        ref.definitionVersion(), ref.periodKey(), ou, dk));
                final AnalyticsCell match = indexed.get(cellKey(ou, dk));
                if (match == null) {
                    drifts.add(new Drift(ref.metricId(),
                            ref.periodKey(), ou, dk,
                            "column-store has row row-store does not",
                            null,
                            value.get(i) == null ? null
                                    : value.get(i).toPlainString()));
                    continue;
                }
                final Drift d = compare(ref, ou, dk, match,
                        count.nulls().isNull(i) ? null : count.get(i),
                        sum.get(i), value.get(i), numerator.get(i),
                        denominator.get(i), quality.get(i));
                if (d != null) {
                    drifts.add(d);
                } else {
                    rowsOk++;
                }
            }
        }

        // The first pass proves every columnar row exists in the oracle.
        // This inverse pass proves the shadow snapshot did not omit any
        // row-store cell (including rows beyond the old 50k boundary).
        final int pageSize = 50_000;
        int offset = 0;
        while (true) {
            final List<AnalyticsCell> page = engineRepo.queryCells(
                    new AnalyticsEngineRepository.CellQuery(
                            List.of(), List.of(), List.of(), Map.of(),
                            pageSize, offset));
            for (final AnalyticsCell c : page) {
                final String key = fullCellKey(c.metricId(),
                        c.definitionVersion(), c.periodKey(),
                        c.orgUnitUid(), c.dimensionKey());
                if (!columnarKeys.contains(key)) {
                    drifts.add(new Drift(c.metricId(), c.periodKey(),
                            c.orgUnitUid(), c.dimensionKey(),
                            "row-store has row column-store does not",
                            toStr(c.value()), null));
                }
            }
            if (page.size() < pageSize) {
                break;
            }
            offset += page.size();
        }

        return new VerifyReport(manifest.generation(),
                segmentsChecked, rowsChecked, rowsOk,
                drifts.size(), drifts);
    }

    private static Drift compare(final SegmentRef ref, final String ou,
                                    final String dk,
                                    final AnalyticsCell rowStore,
                                    final Long colCount,
                                    final BigDecimal colSum,
                                    final BigDecimal colValue,
                                    final BigDecimal colNumerator,
                                    final BigDecimal colDenominator,
                                    final String colQuality) {
        if (!equalNullable(rowStore.countValue(), colCount)) {
            return new Drift(ref.metricId(), ref.periodKey(), ou, dk,
                    "count drift",
                    String.valueOf(rowStore.countValue()),
                    String.valueOf(colCount));
        }
        if (!decimalEqual(rowStore.sumValue(), colSum)) {
            return new Drift(ref.metricId(), ref.periodKey(), ou, dk,
                    "sum drift",
                    toStr(rowStore.sumValue()), toStr(colSum));
        }
        if (!decimalEqual(rowStore.value(), colValue)) {
            return new Drift(ref.metricId(), ref.periodKey(), ou, dk,
                    "value drift",
                    toStr(rowStore.value()), toStr(colValue));
        }
        if (!decimalEqual(rowStore.numeratorValue(), colNumerator)) {
            return new Drift(ref.metricId(), ref.periodKey(), ou, dk,
                    "numerator drift", toStr(rowStore.numeratorValue()),
                    toStr(colNumerator));
        }
        if (!decimalEqual(rowStore.denominatorValue(), colDenominator)) {
            return new Drift(ref.metricId(), ref.periodKey(), ou, dk,
                    "denominator drift", toStr(rowStore.denominatorValue()),
                    toStr(colDenominator));
        }
        if (!Objects.equals(rowStore.qualityState(), colQuality)) {
            return new Drift(ref.metricId(), ref.periodKey(), ou, dk,
                    "quality-state drift", rowStore.qualityState(),
                    colQuality);
        }
        return null;
    }

    private static boolean equalNullable(final Long a, final Long b) {
        if (a == null && b == null) {
            return true;
        }
        if (a == null || b == null) {
            return false;
        }
        return a.longValue() == b.longValue();
    }

    private static boolean decimalEqual(final BigDecimal a,
                                          final BigDecimal b) {
        if (a == null && b == null) {
            return true;
        }
        if (a == null || b == null) {
            return false;
        }
        return a.compareTo(b) == 0;
    }

    private static String toStr(final BigDecimal v) {
        return v == null ? null : v.toPlainString();
    }

    private Map<String, ColumnBatch> decodeAllColumns(final Segment segment) {
        final Map<String, ColumnBatch> out = new LinkedHashMap<>();
        for (final SegmentColumn c : segment.columns()) {
            final Codec codec = CodecResolver.resolve(c.codecId());
            if (codec == null) {
                throw new IllegalStateException(
                        "segment column '" + c.name()
                      + "' references unknown codec '"
                      + c.codecId() + "'");
            }
            out.put(c.name(), codec.decode(c.encoded(), segment.rowCount()));
        }
        return out;
    }

    private static String cellKey(final String ou, final String dim) {
        return ou + "\0" + (dim == null ? "" : dim);
    }

    private static String fullCellKey(final UUID metricId,
                                        final int definitionVersion,
                                        final String period,
                                        final String ou,
                                        final String dim) {
        return metricId + "\0" + definitionVersion + "\0" + period
                + "\0" + cellKey(ou, dim);
    }
}
