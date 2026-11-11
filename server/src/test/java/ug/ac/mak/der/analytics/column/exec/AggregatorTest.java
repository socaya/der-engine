package ug.ac.mak.der.analytics.column.exec;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.column.ColumnBatch;

class AggregatorTest {

    private ColumnBatch.Int64 counts() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(6);
        b.set(0, 10);
        b.set(1, 20);
        b.setNull(2);
        b.set(3, 40);
        b.set(4, 50);
        b.set(5, 60);
        b.seal();
        return b;
    }

    private ColumnBatch.Decimal values() {
        final ColumnBatch.Decimal b = new ColumnBatch.Decimal(6);
        b.set(0, new BigDecimal("1.5"));
        b.set(1, new BigDecimal("2.5"));
        b.set(2, null);
        b.set(3, new BigDecimal("4.5"));
        b.set(4, new BigDecimal("5.5"));
        b.set(5, new BigDecimal("6.5"));
        b.seal();
        return b;
    }

    private SelectionBitmap selectOdd(final int rowCount) {
        final SelectionBitmap s = SelectionBitmap.none(rowCount);
        for (int i = 1; i < rowCount; i += 2) {
            s.select(i);
        }
        return s;
    }

    @Test
    void countExcludesNullsAndDeselected() {
        // All selected, one null (row 2) → count = 5
        final Object v = new Aggregator.Count().apply(counts(),
                SelectionBitmap.allSelected(6));
        assertThat(v).isEqualTo(5L);
    }

    @Test
    void countRespectsSelection() {
        // Odd rows 1,3,5 selected; 1 (value 20), 3 (40), 5 (60) all
        // non-null → count = 3
        final Object v = new Aggregator.Count().apply(counts(),
                selectOdd(6));
        assertThat(v).isEqualTo(3L);
    }

    @Test
    void sumOnInt64AllSelected() {
        final Object v = new Aggregator.Sum().apply(counts(),
                SelectionBitmap.allSelected(6));
        assertThat(v).isEqualTo(new BigDecimal("180"));
    }

    @Test
    void sumOnDecimalWithSelection() {
        // Selected: rows 1,3,5 (odd) → values 2.5 + 4.5 + 6.5 = 13.5
        final Object v = new Aggregator.Sum().apply(values(),
                selectOdd(6));
        assertThat(v).isEqualTo(new BigDecimal("13.5"));
    }

    @Test
    void sumReturnsNullWhenNothingSelected() {
        final Object v = new Aggregator.Sum().apply(counts(),
                SelectionBitmap.none(6));
        assertThat(v).isNull();
    }

    @Test
    void minOnInt64() {
        final Object v = new Aggregator.Min().apply(counts(),
                SelectionBitmap.allSelected(6));
        assertThat(v).isEqualTo(new BigDecimal("10"));
    }

    @Test
    void maxOnInt64() {
        final Object v = new Aggregator.Max().apply(counts(),
                SelectionBitmap.allSelected(6));
        assertThat(v).isEqualTo(new BigDecimal("60"));
    }

    @Test
    void minMaxOnDecimalIgnoreNulls() {
        final Object min = new Aggregator.Min().apply(values(),
                SelectionBitmap.allSelected(6));
        final Object max = new Aggregator.Max().apply(values(),
                SelectionBitmap.allSelected(6));
        assertThat(min).isEqualTo(new BigDecimal("1.5"));
        assertThat(max).isEqualTo(new BigDecimal("6.5"));
    }

    @Test
    void averageIsSumOverCount() {
        // Selected rows 1,3,5 — values 2.5 + 4.5 + 6.5 = 13.5 / 3 = 4.5
        final Object v = new Aggregator.Average().apply(values(),
                selectOdd(6));
        assertThat(v).isEqualTo(new BigDecimal("4.5"));
    }

    @Test
    void averageOnEmptySelectionIsNull() {
        final Object v = new Aggregator.Average().apply(values(),
                SelectionBitmap.none(6));
        assertThat(v).isNull();
    }

    @Test
    void averageRetainsDecimal64Precision() {
        final ColumnBatch.Decimal b = new ColumnBatch.Decimal(3);
        b.set(0, new BigDecimal("1"));
        b.set(1, new BigDecimal("1"));
        b.set(2, new BigDecimal("1"));
        b.seal();
        final Object v = new Aggregator.Average().apply(b,
                SelectionBitmap.allSelected(3));
        // 3 / 3 = 1 → exact
        assertThat(v).isEqualTo(new BigDecimal("1"));
    }

    @Test
    void sumOnStringColumnRejected() {
        final ColumnBatch.Str s = new ColumnBatch.Str(2);
        s.set(0, "a");
        s.set(1, "b");
        s.seal();
        assertThatThrownBy(() -> new Aggregator.Sum().apply(s,
                SelectionBitmap.allSelected(2)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
