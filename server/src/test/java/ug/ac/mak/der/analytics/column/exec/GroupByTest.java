package ug.ac.mak.der.analytics.column.exec;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.column.ColumnBatch;

class GroupByTest {

    private Map<String, ColumnBatch> buildBatch() {
        final ColumnBatch.Str ou = new ColumnBatch.Str(6);
        ou.set(0, "OU-A");
        ou.set(1, "OU-B");
        ou.set(2, "OU-A");
        ou.set(3, null);
        ou.set(4, "OU-A");
        ou.set(5, "OU-B");
        ou.seal();

        final ColumnBatch.Int64 count = new ColumnBatch.Int64(6);
        count.set(0, 10);
        count.set(1, 20);
        count.set(2, 30);
        count.set(3, 40);
        count.set(4, 50);
        count.set(5, 60);
        count.seal();

        final ColumnBatch.Decimal value = new ColumnBatch.Decimal(6);
        value.set(0, new BigDecimal("1.5"));
        value.set(1, new BigDecimal("2.5"));
        value.set(2, new BigDecimal("3.5"));
        value.set(3, new BigDecimal("4.5"));
        value.set(4, new BigDecimal("5.5"));
        value.set(5, new BigDecimal("6.5"));
        value.seal();

        return Map.of("ou", ou, "count", count, "value", value);
    }

    @Test
    void singleColumnGroupBySumAndCount() {
        final GroupBy.GroupByResult r = GroupBy.run(
                buildBatch(), null,
                List.of("ou"),
                Map.of("total", new GroupBy.AggregateSpec("count",
                                new Aggregator.Sum()),
                        "n", new GroupBy.AggregateSpec("count",
                                new Aggregator.Count())));

        // OU-A rows: 0,2,4 → sum 90, count 3
        // OU-B rows: 1,5 → sum 80, count 2
        // null row: 3 → sum 40, count 1
        assertThat(r.rows()).hasSize(3);
        assertThat(r.rows().get(new GroupBy.GroupKey(List.of("OU-A")))
                .get("total"))
                .isEqualTo(new BigDecimal("90"));
        assertThat(r.rows().get(new GroupBy.GroupKey(List.of("OU-A")))
                .get("n")).isEqualTo(3L);
        assertThat(r.rows().get(new GroupBy.GroupKey(List.of("OU-B")))
                .get("total"))
                .isEqualTo(new BigDecimal("80"));
    }

    @Test
    void nullKeyIsItsOwnGroup() {
        final GroupBy.GroupByResult r = GroupBy.run(
                buildBatch(), null,
                List.of("ou"),
                Map.of("n", new GroupBy.AggregateSpec("count",
                        new Aggregator.Count())));

        final GroupBy.GroupKey nullKey = new GroupBy.GroupKey(
                java.util.Collections.singletonList(null));
        assertThat(r.rows()).containsKey(nullKey);
        assertThat(r.rows().get(nullKey).get("n")).isEqualTo(1L);
    }

    @Test
    void multiColumnGroupByKeysOnCombination() {
        // Group by (ou, count-bucket) — bucket is count > 25
        final ColumnBatch.Str ou = (ColumnBatch.Str)
                buildBatch().get("ou");
        final ColumnBatch.Str bucket = new ColumnBatch.Str(6);
        bucket.set(0, "lo");
        bucket.set(1, "lo");
        bucket.set(2, "hi");
        bucket.set(3, "hi");
        bucket.set(4, "hi");
        bucket.set(5, "hi");
        bucket.seal();
        final ColumnBatch.Int64 count = (ColumnBatch.Int64)
                buildBatch().get("count");

        final GroupBy.GroupByResult r = GroupBy.run(
                Map.of("ou", ou, "bucket", bucket, "count", count),
                null,
                List.of("ou", "bucket"),
                Map.of("n", new GroupBy.AggregateSpec("count",
                        new Aggregator.Count())));

        // Distinct (ou,bucket): (A,lo)=1, (B,lo)=1, (A,hi)=2,
        // (null,hi)=1, (B,hi)=1 → 5 groups
        assertThat(r.rows()).hasSize(5);
        assertThat(r.rows().get(new GroupBy.GroupKey(
                List.of("OU-A", "hi"))).get("n")).isEqualTo(2L);
    }

    @Test
    void selectionNarrowsBeforeGrouping() {
        // Only rows 0,2 selected → both OU-A → one group
        final SelectionBitmap sel = SelectionBitmap.none(6);
        sel.select(0);
        sel.select(2);

        final GroupBy.GroupByResult r = GroupBy.run(
                buildBatch(), sel,
                List.of("ou"),
                Map.of("total", new GroupBy.AggregateSpec("count",
                        new Aggregator.Sum())));

        assertThat(r.rows()).hasSize(1);
        assertThat(r.rows().get(new GroupBy.GroupKey(List.of("OU-A")))
                .get("total"))
                .isEqualTo(new BigDecimal("40"));
    }

    @Test
    void emptySelectionYieldsEmptyResult() {
        final GroupBy.GroupByResult r = GroupBy.run(
                buildBatch(), SelectionBitmap.none(6),
                List.of("ou"),
                Map.of("n", new GroupBy.AggregateSpec("count",
                        new Aggregator.Count())));
        assertThat(r.rows()).isEmpty();
    }

    @Test
    void averageIsSumOverCountPerGroup() {
        final GroupBy.GroupByResult r = GroupBy.run(
                buildBatch(), null,
                List.of("ou"),
                Map.of("avg", new GroupBy.AggregateSpec("value",
                        new Aggregator.Average())));

        // OU-A: (1.5 + 3.5 + 5.5) / 3 = 3.5
        assertThat(r.rows().get(new GroupBy.GroupKey(List.of("OU-A")))
                .get("avg"))
                .isEqualTo(new BigDecimal("3.5"));
    }

    @Test
    void missingGroupColumnRejected() {
        assertThatThrownBy(() -> GroupBy.run(
                buildBatch(), null,
                List.of("nope"),
                Map.of("n", new GroupBy.AggregateSpec("count",
                        new Aggregator.Count()))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void firstSeenOrderPreserved() {
        final GroupBy.GroupByResult r = GroupBy.run(
                buildBatch(), null,
                List.of("ou"),
                Map.of("n", new GroupBy.AggregateSpec("count",
                        new Aggregator.Count())));

        final List<Object> order = r.rows().keySet().stream()
                .map(k -> k.values().get(0))
                .toList();
        // Row 0 OU-A, row 1 OU-B, row 3 null, row 2/4 OU-A again,
        // row 5 OU-B → first-seen: OU-A, OU-B, null
        assertThat(order).containsExactly("OU-A", "OU-B", null);
    }
}
