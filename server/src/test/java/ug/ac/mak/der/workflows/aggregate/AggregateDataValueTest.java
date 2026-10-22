package ug.ac.mak.der.workflows.aggregate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class AggregateDataValueTest {

    private static final UUID VID = UUID.randomUUID();
    private static final UUID UID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");

    @Test
    void builds() {
        final AggregateDataValue v = new AggregateDataValue(
                VID, "de", "ou", "2026Q1", "coc", "aoc", "123", "c", UID, NOW, 1);
        assertThat(v.valueText()).isEqualTo("123");
        assertThat(v.valueVersion()).isEqualTo(1);
        assertThat(v.compoundKey()).isEqualTo("de|ou|2026Q1|coc|aoc");
    }

    @Test
    void nullOrBlankCombosDefaultToDhis2Default() {
        final AggregateDataValue a = new AggregateDataValue(
                VID, "de", "ou", "2026Q1", null, null, "1", null, UID, NOW, 1);
        assertThat(a.categoryOptionComboUid()).isEqualTo(AggregateDataValue.DEFAULT_COC);
        assertThat(a.attributeOptionComboUid()).isEqualTo(AggregateDataValue.DEFAULT_COC);

        final AggregateDataValue b = new AggregateDataValue(
                VID, "de", "ou", "2026Q1", "  ", "", "1", null, UID, NOW, 1);
        assertThat(b.categoryOptionComboUid()).isEqualTo(AggregateDataValue.DEFAULT_COC);
        assertThat(b.attributeOptionComboUid()).isEqualTo(AggregateDataValue.DEFAULT_COC);
    }

    @Test
    void rejectsBlanks() {
        assertThatThrownBy(() -> new AggregateDataValue(
                VID, "de", "ou", " ", "coc", "aoc", "1", null, UID, NOW, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AggregateDataValue(
                VID, "de", "ou", "2026Q1", "coc", "aoc", "   ", null, UID, NOW, 1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsZeroVersion() {
        assertThatThrownBy(() -> new AggregateDataValue(
                VID, "de", "ou", "2026Q1", "coc", "aoc", "1", null, UID, NOW, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNullRequiredFields() {
        assertThatThrownBy(() -> new AggregateDataValue(
                null, "de", "ou", "2026Q1", "coc", "aoc", "1", null, UID, NOW, 1))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new AggregateDataValue(
                VID, null, "ou", "2026Q1", "coc", "aoc", "1", null, UID, NOW, 1))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new AggregateDataValue(
                VID, "de", null, "2026Q1", "coc", "aoc", "1", null, UID, NOW, 1))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new AggregateDataValue(
                VID, "de", "ou", null, "coc", "aoc", "1", null, UID, NOW, 1))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new AggregateDataValue(
                VID, "de", "ou", "2026Q1", "coc", "aoc", null, null, UID, NOW, 1))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new AggregateDataValue(
                VID, "de", "ou", "2026Q1", "coc", "aoc", "1", null, null, NOW, 1))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new AggregateDataValue(
                VID, "de", "ou", "2026Q1", "coc", "aoc", "1", null, UID, null, 1))
                .isInstanceOf(NullPointerException.class);
    }
}
