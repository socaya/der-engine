package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.expression.Evaluator;
import ug.ac.mak.der.analytics.expression.ExpressionContext;
import ug.ac.mak.der.analytics.expression.Parser;

class EnrollmentExpressionContextTest {

    private final ObjectMapper json = new ObjectMapper();

    private EnrollmentExpressionContext.Enrollment enrollment() {
        return new EnrollmentExpressionContext.Enrollment(
                "en-1", "P1", "tei-1", "OU-A",
                LocalDate.of(2026, 1, 10),
                LocalDate.of(2026, 1, 5),
                "ACTIVE");
    }

    @Test
    void stageQualifiedRefResolvesLatestEventForThatStage() {
        final ExpressionContext ctx = EnrollmentExpressionContext.of(
                json, enrollment(), List.of(
                        new EnrollmentExpressionContext.EventRow(
                                "ev-old", "STG1",
                                LocalDate.of(2026, 1, 15),
                                "2026-01-15T00:00:00Z", "ACTIVE",
                                "{\"DE1\":10}"),
                        new EnrollmentExpressionContext.EventRow(
                                "ev-new", "STG1",
                                LocalDate.of(2026, 2, 10),
                                "2026-02-10T00:00:00Z", "COMPLETED",
                                "{\"DE1\":42}")));
        final Object v = new Evaluator(ctx).eval(
                Parser.parse("#{STG1.DE1}"));
        assertThat(v).isEqualTo(new BigDecimal("42"));
    }

    @Test
    void unqualifiedRefFallsBackAcrossStages() {
        final ExpressionContext ctx = EnrollmentExpressionContext.of(
                json, enrollment(), List.of(
                        new EnrollmentExpressionContext.EventRow(
                                "ev-1", "STG1",
                                LocalDate.of(2026, 2, 10),
                                "2026-02-10T00:00:00Z", "COMPLETED",
                                "{\"DE_SHARED\":99}")));
        final Object v = new Evaluator(ctx).eval(
                Parser.parse("#{DE_SHARED}"));
        assertThat(v).isEqualTo(new BigDecimal("99"));
    }

    @Test
    void missingDataElementReturnsNull() {
        final ExpressionContext ctx = EnrollmentExpressionContext.of(
                json, enrollment(), List.of());
        assertThat(new Evaluator(ctx).eval(Parser.parse("#{STG1.DE1}")))
                .isNull();
    }

    @Test
    void variableSurfaceCarriesEnrollmentMetadata() {
        final ExpressionContext ctx = EnrollmentExpressionContext.of(
                json, enrollment(), List.of(
                        new EnrollmentExpressionContext.EventRow(
                                "ev-1", "STG1",
                                LocalDate.of(2026, 1, 20),
                                "2026-01-20T00:00:00Z", "ACTIVE", "{}")));
        assertThat(ctx.variable("enrollment_date").orElse(null))
                .isEqualTo(LocalDate.of(2026, 1, 10));
        assertThat(ctx.variable("enrollment_status").orElse(null))
                .isEqualTo("ACTIVE");
        assertThat(ctx.variable("program_uid").orElse(null))
                .isEqualTo("P1");
        assertThat(ctx.variable("tei_uid").orElse(null))
                .isEqualTo("tei-1");
        assertThat(ctx.variable("event_count").orElse(null))
                .isEqualTo(BigDecimal.ONE);
    }

    @Test
    void attributeRefReturnsEmptyWhenNoTeaMap() {
        final ExpressionContext ctx = EnrollmentExpressionContext.of(
                json, enrollment(), List.of());
        // 3-arg form supplies no attributes — A{TEA1} stays empty.
        assertThat(ctx.attribute("TEA1")).isEmpty();
    }

    @Test
    void attributeRefResolvesFromTeaMap() {
        final ExpressionContext ctx = EnrollmentExpressionContext.of(
                json, enrollment(), List.of(),
                java.util.Map.of("TEA_SEX", "F",
                        "TEA_AGE", new BigDecimal("28")));
        assertThat(ctx.attribute("TEA_SEX").orElse(null)).isEqualTo("F");
        assertThat(new Evaluator(ctx).eval(Parser.parse("A{TEA_AGE} + 2")))
                .isEqualTo(new BigDecimal("30"));
        assertThat(ctx.attribute("TEA_MISSING")).isEmpty();
    }

    @Test
    void parseAttributesHandlesTypedJson() {
        final java.util.Map<String, Object> m =
                EnrollmentExpressionContext.parseAttributes(json,
                        "{\"TEA1\":\"F\",\"TEA2\":42,\"TEA3\":true}");
        assertThat(m)
                .containsEntry("TEA1", "F")
                .containsEntry("TEA2", new BigDecimal("42"))
                .containsEntry("TEA3", true);
    }

    @Test
    void latestEventSortTiesBreakOnUpdatedAt() {
        final ExpressionContext ctx = EnrollmentExpressionContext.of(
                json, enrollment(), List.of(
                        new EnrollmentExpressionContext.EventRow(
                                "ev-a", "STG1",
                                LocalDate.of(2026, 2, 10),
                                "2026-02-10T08:00:00Z", "ACTIVE",
                                "{\"DE1\":1}"),
                        new EnrollmentExpressionContext.EventRow(
                                "ev-b", "STG1",
                                LocalDate.of(2026, 2, 10),
                                "2026-02-10T14:00:00Z", "COMPLETED",
                                "{\"DE1\":2}")));
        assertThat(new Evaluator(ctx).eval(Parser.parse("#{STG1.DE1}")))
                .isEqualTo(new BigDecimal("2"));
    }

    @Test
    void daysBetweenEnrollmentAndIncident() {
        final ExpressionContext ctx = EnrollmentExpressionContext.of(
                json, enrollment(), List.of());
        final Object v = new Evaluator(ctx).eval(
                Parser.parse(
                        "d2:daysBetween(V{incident_date},"
                      + " V{enrollment_date})"));
        assertThat(v).isEqualTo(BigDecimal.valueOf(5L));
    }
}
