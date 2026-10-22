package ug.ac.mak.der.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

class FacilitySummaryRowTest {

    @Test
    void rejectsMissingAndNegative() {
        final Instant now = Instant.now();
        assertThatThrownBy(() -> new FacilitySummaryRow(null, "p", FacilitySummaryRow.Kind.AGGREGATE, 1, now))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new FacilitySummaryRow("ou", null, FacilitySummaryRow.Kind.AGGREGATE, 1, now))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new FacilitySummaryRow("ou", "p", null, 1, now))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new FacilitySummaryRow("ou", "p", FacilitySummaryRow.Kind.AGGREGATE, -1, now))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FacilitySummaryRow("ou", "p", FacilitySummaryRow.Kind.AGGREGATE, 1, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void kindsSurface() {
        assertThat(FacilitySummaryRow.Kind.values())
                .containsExactly(FacilitySummaryRow.Kind.AGGREGATE, FacilitySummaryRow.Kind.EVENT);
    }
}
