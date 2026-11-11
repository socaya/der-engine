package ug.ac.mak.der.analytics.column.exec;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import ug.ac.mak.der.analytics.column.Codec;
import ug.ac.mak.der.analytics.column.CodecResolver;
import ug.ac.mak.der.analytics.column.ColumnBatch;
import ug.ac.mak.der.analytics.column.segment.Segment;
import ug.ac.mak.der.analytics.column.segment.SegmentColumn;
import ug.ac.mak.der.analytics.column.segment.SegmentReader;

/**
 * Read a segment (or a column subset of one) and decode the
 * requested columns into {@link ColumnBatch}es ready for filter
 * + aggregate evaluation (SRS §6 vectorised scan).
 *
 * <p>Uses {@link SegmentReader#projection} so unread columns
 * never touch RAM, then dispatches each column through
 * {@link CodecResolver} so the writer's codec instance doesn't
 * leak into the reader.</p>
 */
public final class ColumnScanner {

    private ColumnScanner() {
    }

    /** Load every column of {@code segment} into decoded batches. */
    public static ScannedSegment loadAll(final Segment segment) {
        Objects.requireNonNull(segment, "segment");
        return decode(segment.rowCount(), segment.columns());
    }

    /** Load only the named columns from a segment file on disk. */
    public static ScannedSegment load(final Path segmentFile,
                                         final List<String> columns)
            throws IOException {
        Objects.requireNonNull(segmentFile, "segmentFile");
        Objects.requireNonNull(columns, "columns");
        final SegmentReader.Projection p = SegmentReader.projection(
                segmentFile, columns);
        return decode(p.rowCount(), p.columns());
    }

    private static ScannedSegment decode(final int rowCount,
                                           final List<SegmentColumn> cols) {
        final Map<String, ColumnBatch> batches = new LinkedHashMap<>();
        final List<String> order = new ArrayList<>(cols.size());
        for (final SegmentColumn c : cols) {
            final Codec codec = CodecResolver.resolve(c.codecId());
            if (codec == null) {
                throw new IllegalStateException(
                        "unknown codec id '" + c.codecId()
                      + "' for column '" + c.name() + "'");
            }
            batches.put(c.name(), codec.decode(c.encoded(), rowCount));
            order.add(c.name());
        }
        return new ScannedSegment(rowCount, batches, order);
    }

    /** In-memory projection of a scan — ready for filter + aggregate. */
    public record ScannedSegment(int rowCount,
                                   Map<String, ColumnBatch> batches,
                                   List<String> columnOrder) {

        public ScannedSegment {
            batches = Map.copyOf(batches);
            columnOrder = List.copyOf(columnOrder);
        }

        public SelectionBitmap applyFilter(final Filter filter) {
            if (filter == null) {
                return SelectionBitmap.allSelected(rowCount);
            }
            return filter.evaluate(batches, rowCount);
        }
    }
}
