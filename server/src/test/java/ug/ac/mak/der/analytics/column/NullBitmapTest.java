package ug.ac.mak.der.analytics.column;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class NullBitmapTest {

    @Test
    void newBitmapHasZeroNulls() {
        final NullBitmap bm = new NullBitmap(100);
        assertThat(bm.rowCount()).isEqualTo(100);
        assertThat(bm.nullCount()).isZero();
        for (int i = 0; i < 100; i++) {
            assertThat(bm.isNull(i)).isFalse();
        }
    }

    @Test
    void setNullIsIdempotent() {
        final NullBitmap bm = new NullBitmap(10);
        bm.setNull(3);
        bm.setNull(3);
        bm.setNull(3);
        assertThat(bm.isNull(3)).isTrue();
        assertThat(bm.nullCount()).isEqualTo(1);
    }

    @Test
    void spansMultipleWords() {
        final NullBitmap bm = new NullBitmap(200);
        bm.setNull(0);
        bm.setNull(63);
        bm.setNull(64);
        bm.setNull(127);
        bm.setNull(199);
        assertThat(bm.nullCount()).isEqualTo(5);
        assertThat(bm.isNull(64)).isTrue();
        assertThat(bm.isNull(65)).isFalse();
    }

    @Test
    void outOfRangeThrows() {
        final NullBitmap bm = new NullBitmap(10);
        assertThatThrownBy(() -> bm.setNull(10))
                .isInstanceOf(IndexOutOfBoundsException.class);
        assertThatThrownBy(() -> bm.isNull(-1))
                .isInstanceOf(IndexOutOfBoundsException.class);
    }

    @Test
    void negativeRowCountRejected() {
        assertThatThrownBy(() -> new NullBitmap(-5))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reconstructFromWordsPreservesState() {
        final NullBitmap source = new NullBitmap(70);
        source.setNull(5);
        source.setNull(69);
        final NullBitmap copy = new NullBitmap(
                source.words(), source.rowCount(), source.nullCount());
        assertThat(copy.isNull(5)).isTrue();
        assertThat(copy.isNull(69)).isTrue();
        assertThat(copy.nullCount()).isEqualTo(2);
    }
}
