package ug.ac.mak.der.analytics.column.exec;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class SelectionBitmapTest {

    @Test
    void allSelectedBitmapHasEveryBitSet() {
        final SelectionBitmap b = SelectionBitmap.allSelected(130);
        assertThat(b.selectedCount()).isEqualTo(130);
        for (int i = 0; i < 130; i++) {
            assertThat(b.isSelected(i)).isTrue();
        }
    }

    @Test
    void noneBitmapIsEmpty() {
        final SelectionBitmap b = SelectionBitmap.none(100);
        assertThat(b.selectedCount()).isZero();
    }

    @Test
    void selectDeselectRoundTrip() {
        final SelectionBitmap b = SelectionBitmap.none(100);
        b.select(5);
        b.select(50);
        b.select(99);
        assertThat(b.selectedCount()).isEqualTo(3);
        b.deselect(50);
        assertThat(b.isSelected(50)).isFalse();
        assertThat(b.selectedCount()).isEqualTo(2);
    }

    @Test
    void andIntersectsBits() {
        final SelectionBitmap a = SelectionBitmap.none(10);
        a.select(1);
        a.select(3);
        a.select(5);
        final SelectionBitmap b = SelectionBitmap.none(10);
        b.select(3);
        b.select(5);
        b.select(7);
        a.and(b);
        assertThat(a.selectedRows()).containsExactly(3, 5);
    }

    @Test
    void orUnionsBits() {
        final SelectionBitmap a = SelectionBitmap.none(10);
        a.select(1);
        final SelectionBitmap b = SelectionBitmap.none(10);
        b.select(2);
        b.select(9);
        a.or(b);
        assertThat(a.selectedRows()).containsExactly(1, 2, 9);
    }

    @Test
    void notRespectsRowCountBoundary() {
        final SelectionBitmap b = SelectionBitmap.none(130);
        b.select(0);
        b.select(129);
        b.not();
        // 128 selected rows (130 total - 2 originally set)
        assertThat(b.selectedCount()).isEqualTo(128);
        assertThat(b.isSelected(0)).isFalse();
        assertThat(b.isSelected(129)).isFalse();
        assertThat(b.isSelected(50)).isTrue();
    }

    @Test
    void mismatchedShapeAndRejected() {
        final SelectionBitmap a = SelectionBitmap.none(10);
        final SelectionBitmap b = SelectionBitmap.none(11);
        assertThatThrownBy(() -> a.and(b))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void outOfRangeSelectRejected() {
        final SelectionBitmap b = SelectionBitmap.none(10);
        assertThatThrownBy(() -> b.select(10))
                .isInstanceOf(IndexOutOfBoundsException.class);
    }

    @Test
    void selectedRowsReturnsSortedAscending() {
        final SelectionBitmap b = SelectionBitmap.none(200);
        b.select(199);
        b.select(50);
        b.select(1);
        b.select(64);
        assertThat(b.selectedRows()).containsExactly(1, 50, 64, 199);
    }
}
