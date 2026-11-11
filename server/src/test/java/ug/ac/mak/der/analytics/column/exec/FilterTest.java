package ug.ac.mak.der.analytics.column.exec;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.column.ColumnBatch;

class FilterTest {

    private ColumnBatch.Str orgUnits() {
        final ColumnBatch.Str b = new ColumnBatch.Str(6);
        b.set(0, "OU-A");
        b.set(1, "OU-B");
        b.set(2, "OU-A");
        b.set(3, null);
        b.set(4, "OU-C");
        b.set(5, "OU-B");
        b.seal();
        return b;
    }

    private ColumnBatch.Int64 counts() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(6);
        b.set(0, 10);
        b.set(1, 20);
        b.set(2, 30);
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
        b.set(2, new BigDecimal("3.5"));
        b.set(3, null);
        b.set(4, new BigDecimal("4.5"));
        b.set(5, new BigDecimal("5.5"));
        b.seal();
        return b;
    }

    @Test
    void equalsOnStringPicksMatchingRows() {
        final SelectionBitmap sel = new Filter.Equals("ou", "OU-A")
                .evaluate(Map.of("ou", orgUnits()), 6);
        assertThat(sel.selectedRows()).containsExactly(0, 2);
    }

    @Test
    void equalsOnInt64PicksMatchingRow() {
        final SelectionBitmap sel = new Filter.Equals("count", 30L)
                .evaluate(Map.of("count", counts()), 6);
        assertThat(sel.selectedRows()).containsExactly(2);
    }

    @Test
    void equalsOnDecimalComparesByValue() {
        final SelectionBitmap sel = new Filter.Equals("value",
                new BigDecimal("2.5000"))
                .evaluate(Map.of("value", values()), 6);
        assertThat(sel.selectedRows()).containsExactly(1);
    }

    @Test
    void inFilterAcceptsAnyOfTheList() {
        final SelectionBitmap sel = new Filter.In("ou",
                List.of("OU-A", "OU-C"))
                .evaluate(Map.of("ou", orgUnits()), 6);
        assertThat(sel.selectedRows()).containsExactly(0, 2, 4);
    }

    @Test
    void betweenOnInt64IsInclusive() {
        final SelectionBitmap sel = new Filter.Between("count", 20L, 50L)
                .evaluate(Map.of("count", counts()), 6);
        assertThat(sel.selectedRows()).containsExactly(1, 2, 3, 4);
    }

    @Test
    void betweenOnDecimalIsInclusive() {
        final SelectionBitmap sel = new Filter.Between("value",
                new BigDecimal("2.5"), new BigDecimal("4.5"))
                .evaluate(Map.of("value", values()), 6);
        assertThat(sel.selectedRows()).containsExactly(1, 2, 4);
    }

    @Test
    void isNotNullExcludesNullRows() {
        final SelectionBitmap sel = new Filter.IsNotNull("ou")
                .evaluate(Map.of("ou", orgUnits()), 6);
        assertThat(sel.selectedRows()).containsExactly(0, 1, 2, 4, 5);
    }

    @Test
    void andComposesFilters() {
        final Filter f = new Filter.And(List.of(
                new Filter.Equals("ou", "OU-A"),
                new Filter.Between("count", 0L, 15L)));
        final SelectionBitmap sel = f.evaluate(
                Map.of("ou", orgUnits(), "count", counts()), 6);
        assertThat(sel.selectedRows()).containsExactly(0);
    }

    @Test
    void orComposesFilters() {
        final Filter f = new Filter.Or(List.of(
                new Filter.Equals("ou", "OU-A"),
                new Filter.Equals("ou", "OU-C")));
        final SelectionBitmap sel = f.evaluate(
                Map.of("ou", orgUnits()), 6);
        assertThat(sel.selectedRows()).containsExactly(0, 2, 4);
    }

    @Test
    void notInverts() {
        final Filter f = new Filter.Not(new Filter.Equals("ou", "OU-A"));
        final SelectionBitmap sel = f.evaluate(
                Map.of("ou", orgUnits()), 6);
        // Everything except rows 0 and 2.
        assertThat(sel.selectedRows()).containsExactly(1, 3, 4, 5);
    }

    @Test
    void missingColumnRejected() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                new Filter.Equals("nope", "x")
                        .evaluate(Map.of("ou", orgUnits()), 6))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
