package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.expression.ExpressionContext;

class DimensionKeyTest {

    @Test
    void emptyDimensionsEncodeToEmptyString() {
        final ExpressionContext ctx = ExpressionContext.of(Map.of(),
                Map.of(), Map.of(), Map.of());
        assertThat(DimensionKey.encode(List.of(), ctx)).isEmpty();
    }

    @Test
    void dataElementDimensionEncodesValue() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of("SEX_DE", "F"), Map.of(), Map.of(), Map.of());
        final String key = DimensionKey.encode(List.of(
                new AnalyticsDimension("sex",
                        AnalyticsDimension.Kind.DATA_ELEMENT,
                        "SEX_DE", List.of())), ctx);
        assertThat(key).isEqualTo("sex=F");
    }

    @Test
    void dimensionsAreSortedByNameForStability() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of("SEX_DE", "F", "AGE_DE", "25"),
                Map.of(),
                Map.of(),
                Map.of());
        final List<AnalyticsDimension> dims = List.of(
                new AnalyticsDimension("sex",
                        AnalyticsDimension.Kind.DATA_ELEMENT,
                        "SEX_DE", List.of()),
                new AnalyticsDimension("age",
                        AnalyticsDimension.Kind.DATA_ELEMENT,
                        "AGE_DE", List.of()));
        final String key = DimensionKey.encode(dims, ctx);
        // 'age' sorts before 'sex' ASCII-wise so the encoded form is
        // deterministic regardless of declaration order.
        assertThat(key).isEqualTo("age=25|sex=F");
    }

    @Test
    void numericBucketingBinsByRange() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of("AGE_DE", 42),
                Map.of(), Map.of(), Map.of());
        final List<AnalyticsDimension.Bucket> bands = List.of(
                new AnalyticsDimension.Bucket("0-4",
                        BigDecimal.ZERO, new BigDecimal("5")),
                new AnalyticsDimension.Bucket("5-14",
                        new BigDecimal("5"), new BigDecimal("15")),
                new AnalyticsDimension.Bucket("15-24",
                        new BigDecimal("15"), new BigDecimal("25")),
                new AnalyticsDimension.Bucket("25-49",
                        new BigDecimal("25"), new BigDecimal("50")),
                new AnalyticsDimension.Bucket("50+",
                        new BigDecimal("50"), null));
        final String key = DimensionKey.encode(List.of(
                new AnalyticsDimension("age_band",
                        AnalyticsDimension.Kind.DATA_ELEMENT,
                        "AGE_DE", bands)), ctx);
        assertThat(key).isEqualTo("age_band=25-49");
    }

    @Test
    void outOfBandNumericResolvesToUnknown() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of("AGE_DE", -5), Map.of(), Map.of(), Map.of());
        final String key = DimensionKey.encode(List.of(
                new AnalyticsDimension("age_band",
                        AnalyticsDimension.Kind.DATA_ELEMENT,
                        "AGE_DE", List.of(
                                new AnalyticsDimension.Bucket("0-4",
                                        BigDecimal.ZERO,
                                        new BigDecimal("5"))))), ctx);
        assertThat(key).isEqualTo("age_band=" + DimensionKey.UNKNOWN);
    }

    @Test
    void missingValueResolvesToUnknown() {
        final ExpressionContext ctx = ExpressionContext.of(Map.of(),
                Map.of(), Map.of(), Map.of());
        final String key = DimensionKey.encode(List.of(
                new AnalyticsDimension("sex",
                        AnalyticsDimension.Kind.DATA_ELEMENT,
                        "SEX_DE", List.of())), ctx);
        assertThat(key).isEqualTo("sex=" + DimensionKey.UNKNOWN);
    }

    @Test
    void variableDimensionReadsFromVariables() {
        final ExpressionContext ctx = ExpressionContext.of(Map.of(),
                Map.of(),
                Map.of("event_status", "COMPLETED",
                        "program_stage", "STG1"),
                Map.of());
        assertThat(DimensionKey.encode(List.of(
                new AnalyticsDimension("status",
                        AnalyticsDimension.Kind.VARIABLE,
                        "event_status", List.of())), ctx))
                .isEqualTo("status=COMPLETED");
    }

    @Test
    void decodeRoundTrips() {
        final String key = "age_band=25-49|sex=F";
        assertThat(DimensionKey.decode(key))
                .containsEntry("age_band", "25-49")
                .containsEntry("sex", "F");
    }

    @Test
    void decodeHandlesEscapes() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of("DIAG", "A|B=C"),
                Map.of(), Map.of(), Map.of());
        final String key = DimensionKey.encode(List.of(
                new AnalyticsDimension("diag",
                        AnalyticsDimension.Kind.DATA_ELEMENT,
                        "DIAG", List.of())), ctx);
        // Pipe and equals escaped so decode round-trip works.
        assertThat(DimensionKey.decode(key))
                .containsEntry("diag", "A|B=C");
    }

    @Test
    void rejectsNameWithReservedChar() {
        try {
            new AnalyticsDimension("bad=name",
                    AnalyticsDimension.Kind.DATA_ELEMENT, "x", List.of());
            org.junit.jupiter.api.Assertions.fail("expected IAE");
        } catch (IllegalArgumentException ex) {
            assertThat(ex.getMessage()).contains("'=' or '|'");
        }
    }

    @Test
    void likePrefixBuildsSortedPattern() {
        final String p = DimensionKey.likePrefix(Map.of(
                "sex", "F", "age_band", "25-49"));
        assertThat(p).isEqualTo("age_band=25-49|sex=F");
    }

    @Test
    void observedValuesCollectsAcrossKeys() {
        final Map<String, List<String>> out = DimensionKey.observedValues(
                List.of("sex=F|age=25-49",
                        "sex=M|age=25-49",
                        "sex=F|age=50+"));
        assertThat(out.get("sex")).containsExactly("F", "M");
        assertThat(out.get("age")).containsExactly("25-49", "50+");
    }

    @Test
    void localDateAsRawValueIsStringified() {
        final ExpressionContext ctx = ExpressionContext.of(Map.of(),
                Map.of(),
                Map.of("event_date", LocalDate.of(2026, 11, 10)),
                Map.of());
        final String k = DimensionKey.encode(List.of(
                new AnalyticsDimension("on",
                        AnalyticsDimension.Kind.VARIABLE,
                        "event_date", List.of())), ctx);
        assertThat(k).isEqualTo("on=2026-11-10");
    }
}
