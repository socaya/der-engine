package ug.ac.mak.der.analytics.column.exec;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import ug.ac.mak.der.analytics.column.ColumnBatch;

/**
 * Group selected rows by one or more dimension columns and run a
 * set of aggregators per group (SRS §6 FR-QRY-005 group-by over
 * typed column batches).
 *
 * <p>Two-pass over the batch:</p>
 * <ol>
 *   <li>Walk every selected row, compute its {@link GroupKey} from
 *       the dimension columns, and OR the row into that group's
 *       {@link SelectionBitmap}.</li>
 *   <li>Run each supplied {@link Aggregator} against each group's
 *       bitmap. Reuses the Gate 3.2 operators verbatim — the
 *       vectorised per-column loops keep their shape.</li>
 * </ol>
 *
 * <p>Null in a dimension column is its own group — operators can
 * distinguish "orgUnit = (missing)" from "orgUnit = OU-A" without
 * post-processing (SRS §12 fixture 14).</p>
 */
public final class GroupBy {

    private GroupBy() {
    }

    /** One result row per group. */
    public record GroupKey(List<Object> values) {
        public GroupKey {
            values = Collections.unmodifiableList(new ArrayList<>(values));
        }
    }

    public record AggregateSpec(String column, Aggregator aggregator) {
        public AggregateSpec {
            Objects.requireNonNull(column, "column");
            Objects.requireNonNull(aggregator, "aggregator");
        }
    }

    public record GroupByResult(
            List<String> groupColumns,
            List<String> aggregateAliases,
            Map<GroupKey, Map<String, Object>> rows) {
        public GroupByResult {
            groupColumns = List.copyOf(groupColumns);
            aggregateAliases = List.copyOf(aggregateAliases);
            rows = Collections.unmodifiableMap(rows);
        }
    }

    /** Run the grouped aggregation.
     *
     *  @param batches        column batches by name
     *  @param selection      pre-filter selection; null = all rows
     *  @param groupColumns   dimension columns, in order
     *  @param aggregates     alias → (source column, aggregator)
     */
    public static GroupByResult run(
            final Map<String, ColumnBatch> batches,
            final SelectionBitmap selection,
            final List<String> groupColumns,
            final Map<String, AggregateSpec> aggregates) {
        Objects.requireNonNull(batches, "batches");
        Objects.requireNonNull(groupColumns, "groupColumns");
        Objects.requireNonNull(aggregates, "aggregates");

        final int rowCount = batches.values().iterator()
                .next().rowCount();
        final SelectionBitmap sel = selection == null
                ? SelectionBitmap.allSelected(rowCount)
                : selection;
        final List<ColumnBatch> dims = new ArrayList<>(groupColumns.size());
        for (final String col : groupColumns) {
            final ColumnBatch b = batches.get(col);
            if (b == null) {
                throw new IllegalArgumentException(
                        "group-by column '" + col
                      + "' not in batches");
            }
            dims.add(b);
        }

        // Pass 1 — group rows into per-group bitmaps, preserving
        // first-seen order so the caller gets a stable iteration.
        final Map<GroupKey, SelectionBitmap> groups =
                new LinkedHashMap<>();
        for (int i = 0; i < rowCount; i++) {
            if (!sel.isSelected(i)) {
                continue;
            }
            final List<Object> key = new ArrayList<>(dims.size());
            for (final ColumnBatch dim : dims) {
                key.add(valueAt(dim, i));
            }
            final GroupKey gk = new GroupKey(key);
            groups.computeIfAbsent(gk,
                    k -> SelectionBitmap.none(rowCount)).select(i);
        }

        // Pass 2 — run each aggregator per group. Reuses the Gate
        // 3.2 ops — no bespoke accumulators here.
        final Map<GroupKey, Map<String, Object>> out =
                new LinkedHashMap<>();
        for (final Map.Entry<GroupKey, SelectionBitmap> entry
                : groups.entrySet()) {
            final Map<String, Object> aggs = new LinkedHashMap<>();
            for (final Map.Entry<String, AggregateSpec> ae
                    : aggregates.entrySet()) {
                final ColumnBatch src = batches.get(ae.getValue().column());
                if (src == null) {
                    throw new IllegalArgumentException(
                            "aggregate column '" + ae.getValue().column()
                          + "' not in batches");
                }
                aggs.put(ae.getKey(),
                        ae.getValue().aggregator().apply(src,
                                entry.getValue()));
            }
            out.put(entry.getKey(), aggs);
        }
        return new GroupByResult(groupColumns,
                new ArrayList<>(aggregates.keySet()), out);
    }

    private static Object valueAt(final ColumnBatch batch, final int row) {
        if (batch.nulls().isNull(row)) {
            return null;
        }
        if (batch instanceof ColumnBatch.Str s) {
            return s.get(row);
        }
        if (batch instanceof ColumnBatch.Int64 l) {
            return l.get(row);
        }
        if (batch instanceof ColumnBatch.Date d) {
            return d.getEpochDay(row);
        }
        if (batch instanceof ColumnBatch.Bool b) {
            return b.get(row);
        }
        if (batch instanceof ColumnBatch.Decimal d) {
            return d.get(row);
        }
        throw new IllegalStateException(
                "unsupported group-by column type " + batch.type());
    }
}
