package ug.ac.mak.der.analytics.column.sink;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.column.CodecSelector;
import ug.ac.mak.der.analytics.column.ColumnBatch;
import ug.ac.mak.der.analytics.column.ColumnType;
import ug.ac.mak.der.analytics.column.manifest.Manifest;
import ug.ac.mak.der.analytics.column.manifest.ManifestReader;
import ug.ac.mak.der.analytics.column.manifest.ManifestStore;
import ug.ac.mak.der.analytics.column.manifest.ManifestWriter;
import ug.ac.mak.der.analytics.column.manifest.SegmentRef;
import ug.ac.mak.der.analytics.column.segment.Segment;
import ug.ac.mak.der.analytics.column.segment.SegmentColumn;
import ug.ac.mak.der.analytics.column.segment.SegmentWriter;
import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * Sidecar that persists the row-store's materialised cells as
 * columnar segments (SRS FR-STO-001..006). Operator-triggered so
 * the hot path stays decoupled; a scheduled flush lands in Gate
 * 2.8b once the pilot has validated the output shape.
 *
 * <p>Each flush snapshots every materialised cell, groups by
 * {@code (metricId, periodKey)}, writes one segment per group,
 * then publishes a single new manifest generation naming the
 * complete set. Readers that open the manifest see either the
 * old generation or the new one — never a half-published mix.</p>
 */
@Service
public class AnalyticsColumnarSink {

    private static final Logger LOG =
            LoggerFactory.getLogger(AnalyticsColumnarSink.class);
    private static final String ENGINE_VERSION =
            "der-analytics-column-0.1";

    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsColumnarProperties properties;
    private final ObjectMapper json;

    public AnalyticsColumnarSink(
            final AnalyticsEngineRepository engineRepo,
            final AnalyticsColumnarProperties properties,
            final ObjectMapper json) {
        this.engineRepo = Objects.requireNonNull(engineRepo, "engineRepo");
        this.properties = Objects.requireNonNull(properties, "properties");
        this.json = Objects.requireNonNull(json, "json");
    }

    public record FlushResult(
            long generation,
            int segmentsWritten,
            int rowsWritten,
            long bytesWritten,
            double compressionRatio,
            String manifestPath) { }

    public FlushResult flush() throws IOException {
        if (!properties.enabled()) {
            return new FlushResult(-1, 0, 0, 0L, 1.0,
                    "disabled");
        }
        final Path root = properties.rootPathResolved();
        Files.createDirectories(root);
        final ManifestReader reader = new ManifestReader(json);
        final ManifestWriter writer = new ManifestWriter(json);
        final ManifestStore store = new ManifestStore(root, reader, writer);
        final long generation = store.currentGeneration()
                .map(Manifest::generation)
                .map(g -> g + 1)
                .orElse(1L);

        // Snapshot every cell. On a pilot with millions of rows we
        // would stream; for the Gate-2.8 first slice we materialise
        // in memory then group — cells are a projection of the
        // ledger so this is bounded by the materialised set, not
        // the source data.
        final List<AnalyticsCell> cells = engineRepo.queryCells(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(),
                        Map.of(), 50_000, 0));

        final Map<GroupKey, List<AnalyticsCell>> grouped =
                new LinkedHashMap<>();
        for (final AnalyticsCell c : cells) {
            grouped.computeIfAbsent(
                    new GroupKey(c.metricId(),
                            c.definitionVersion(),
                            c.periodKey()),
                    k -> new ArrayList<>()).add(c);
        }

        long totalRows = 0;
        long totalBytes = 0;
        long plainTotalBytes = 0;
        final List<SegmentRef> refs = new ArrayList<>();
        for (final Map.Entry<GroupKey, List<AnalyticsCell>> g
                : grouped.entrySet()) {
            final GroupKey key = g.getKey();
            final List<AnalyticsCell> rows = g.getValue();
            for (int offset = 0; offset < rows.size();
                    offset += properties.rowsPerSegmentCap()) {
                final int end = Math.min(rows.size(),
                        offset + properties.rowsPerSegmentCap());
                final List<AnalyticsCell> slice =
                        rows.subList(offset, end);
                final SegmentWriteOutcome outcome = writeSegment(
                        key, slice, root);
                refs.add(outcome.ref());
                totalRows += slice.size();
                totalBytes += outcome.compressedBytes();
                plainTotalBytes += outcome.plainBytes();
            }
        }

        final Manifest manifest = new Manifest(
                generation, Instant.now(), null,
                Map.of(), ENGINE_VERSION, refs);
        store.publish(manifest);
        final Path manifestFile = root
                .resolve(ug.ac.mak.der.analytics.column.manifest
                        .ManifestFormat.MANIFESTS_DIR)
                .resolve(ug.ac.mak.der.analytics.column.manifest
                        .ManifestFormat.fileName(generation));
        final double ratio = plainTotalBytes == 0
                ? 1.0
                : (double) totalBytes / (double) plainTotalBytes;
        LOG.info("columnar flush gen={} segments={} rows={} bytes={} "
                + "ratio={}",
                generation, refs.size(), totalRows, totalBytes, ratio);
        return new FlushResult(generation, refs.size(), (int) totalRows,
                totalBytes, ratio, manifestFile.toString());
    }

    public Optional<Manifest> currentManifest() throws IOException {
        final ManifestReader reader = new ManifestReader(json);
        final ManifestWriter writer = new ManifestWriter(json);
        final ManifestStore store = new ManifestStore(
                properties.rootPathResolved(), reader, writer);
        return store.currentGeneration();
    }

    /* ─────── internal ─────── */

    private SegmentWriteOutcome writeSegment(final GroupKey key,
                                                final List<AnalyticsCell> rows,
                                                final Path root)
            throws IOException {
        final int n = rows.size();
        final ColumnBatch.Str orgUnit = new ColumnBatch.Str(n);
        final ColumnBatch.Str dim = new ColumnBatch.Str(n);
        final ColumnBatch.Int64 count = new ColumnBatch.Int64(n);
        final ColumnBatch.Decimal sum = new ColumnBatch.Decimal(n);
        final ColumnBatch.Decimal value = new ColumnBatch.Decimal(n);
        final ColumnBatch.Decimal num = new ColumnBatch.Decimal(n);
        final ColumnBatch.Decimal den = new ColumnBatch.Decimal(n);
        final ColumnBatch.Date fresh = new ColumnBatch.Date(n);
        final ColumnBatch.Str quality = new ColumnBatch.Str(n);
        for (int i = 0; i < n; i++) {
            final AnalyticsCell c = rows.get(i);
            orgUnit.set(i, c.orgUnitUid());
            dim.set(i, c.dimensionKey() == null ? "" : c.dimensionKey());
            if (c.countValue() == null) {
                count.setNull(i);
            } else {
                count.set(i, c.countValue());
            }
            sum.set(i, c.sumValue());
            value.set(i, c.value());
            num.set(i, c.numeratorValue());
            den.set(i, c.denominatorValue());
            fresh.set(i, c.freshnessAt() == null
                    ? null
                    : LocalDate.ofInstant(c.freshnessAt(), ZoneOffset.UTC));
            quality.set(i, c.qualityState());
        }
        orgUnit.seal();
        dim.seal();
        count.seal();
        sum.seal();
        value.seal();
        num.seal();
        den.seal();
        fresh.seal();
        quality.seal();

        final CodecSelector selector = CodecSelector.defaultSelector();
        final List<SegmentColumn> cols = new ArrayList<>();
        long plain = 0;
        long chosen = 0;
        final SelectResult o = selectCol("orgUnit", ColumnType.STRING,
                orgUnit, selector);
        cols.add(o.col());
        plain += o.plainBytes();
        chosen += o.chosenBytes();
        final SelectResult d = selectCol("dimensionKey",
                ColumnType.STRING, dim, selector);
        cols.add(d.col());
        plain += d.plainBytes();
        chosen += d.chosenBytes();
        final SelectResult cc = selectCol("count", ColumnType.INT64,
                count, selector);
        cols.add(cc.col());
        plain += cc.plainBytes();
        chosen += cc.chosenBytes();
        final SelectResult ss = selectCol("sum", ColumnType.DECIMAL,
                sum, selector);
        cols.add(ss.col());
        plain += ss.plainBytes();
        chosen += ss.chosenBytes();
        final SelectResult vv = selectCol("value", ColumnType.DECIMAL,
                value, selector);
        cols.add(vv.col());
        plain += vv.plainBytes();
        chosen += vv.chosenBytes();
        final SelectResult nn = selectCol("numerator", ColumnType.DECIMAL,
                num, selector);
        cols.add(nn.col());
        plain += nn.plainBytes();
        chosen += nn.chosenBytes();
        final SelectResult de = selectCol("denominator", ColumnType.DECIMAL,
                den, selector);
        cols.add(de.col());
        plain += de.plainBytes();
        chosen += de.chosenBytes();
        final SelectResult ff = selectCol("freshnessAt", ColumnType.DATE,
                fresh, selector);
        cols.add(ff.col());
        plain += ff.plainBytes();
        chosen += ff.chosenBytes();
        final SelectResult qq = selectCol("qualityState",
                ColumnType.STRING, quality, selector);
        cols.add(qq.col());
        plain += qq.plainBytes();
        chosen += qq.chosenBytes();

        final UUID segmentId = UUID.randomUUID();
        final Segment segment = new Segment(segmentId, n,
                Instant.now(), cols);
        final String relative = "facts/cells/" + key.metricId()
                + "/" + key.periodKey() + "/segment-"
                + segmentId + ".col";
        final Path file = root.resolve(relative);
        SegmentWriter.writeAtomically(segment, file);

        final SegmentRef ref = new SegmentRef(segmentId, relative,
                key.metricId(), key.definitionVersion(),
                key.periodKey(),
                /* orgUnitUid placeholder — segment carries many */
                "*",
                "",
                n);
        return new SegmentWriteOutcome(ref, plain, chosen);
    }

    private SelectResult selectCol(final String name,
                                     final ColumnType type,
                                     final ColumnBatch batch,
                                     final CodecSelector selector) {
        final CodecSelector.Choice choice = selector.select(batch);
        return new SelectResult(
                new SegmentColumn(name, type,
                        choice.codec().codecId(),
                        choice.encoded(),
                        batch.nulls().nullCount()),
                choice.plainBytes(), choice.chosenBytes());
    }

    private record GroupKey(UUID metricId, int definitionVersion,
                              String periodKey) { }

    private record SelectResult(SegmentColumn col,
                                   long plainBytes, long chosenBytes) { }

    private record SegmentWriteOutcome(SegmentRef ref,
                                          long plainBytes,
                                          long compressedBytes) { }
}
