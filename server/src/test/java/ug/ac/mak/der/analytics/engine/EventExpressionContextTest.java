package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.expression.Evaluator;
import ug.ac.mak.der.analytics.expression.ExpressionContext;
import ug.ac.mak.der.analytics.expression.Parser;

class EventExpressionContextTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void dataElementsReadFromJson() {
        final ExpressionContext ctx = EventExpressionContext.of(json,
                "STG1",
                "{\"DE1\":10,\"DE2\":\"abc\",\"DE3\":true}",
                LocalDate.of(2026, 11, 10),
                "OU-A", "COMPLETED");
        assertThat(new Evaluator(ctx).eval(Parser.parse("#{DE1} + 1")))
                .isEqualTo(new BigDecimal("11"));
        assertThat(new Evaluator(ctx).eval(Parser.parse("#{DE2}")))
                .isEqualTo("abc");
        assertThat(new Evaluator(ctx).eval(
                Parser.parse("d2:hasValue(#{DE3})")))
                .isEqualTo(true);
    }

    @Test
    void variableSurfaceCoversDateAndStatus() {
        final ExpressionContext ctx = EventExpressionContext.of(json,
                "STG1", "{}", LocalDate.of(2026, 11, 10),
                "OU-A", "ACTIVE");
        assertThat(ctx.variable("event_date").orElse(null))
                .isEqualTo(LocalDate.of(2026, 11, 10));
        assertThat(ctx.variable("event_status").orElse(null))
                .isEqualTo("ACTIVE");
        assertThat(ctx.variable("org_unit_uid").orElse(null))
                .isEqualTo("OU-A");
        assertThat(ctx.variable("program_stage").orElse(null))
                .isEqualTo("STG1");
        assertThat(ctx.variable("current_date").orElse(null))
                .isNotNull();
    }

    @Test
    void missingDataElementStaysNull() {
        final ExpressionContext ctx = EventExpressionContext.of(json,
                null, "{}", LocalDate.of(2026, 11, 10),
                "OU-A", "ACTIVE");
        assertThat(new Evaluator(ctx).eval(Parser.parse("#{DE1}")))
                .isNull();
    }

    @Test
    void parseableStringDataValueCoercesToNumber() {
        final ExpressionContext ctx = EventExpressionContext.of(json,
                null, "{\"DE1\":\"42\"}",
                LocalDate.of(2026, 11, 10), "OU-A", "ACTIVE");
        assertThat(new Evaluator(ctx).eval(Parser.parse("#{DE1} + 1")))
                .isEqualTo(new BigDecimal("43"));
    }

    @Test
    void mapOverloadBypassesJsonParsing() {
        final ExpressionContext ctx = EventExpressionContext.of(
                "STG1", Map.of("DE1", 7),
                LocalDate.of(2026, 11, 10), "OU-A", "ACTIVE");
        assertThat(new Evaluator(ctx).eval(Parser.parse("#{DE1} * 2")))
                .isEqualTo(new BigDecimal("14"));
    }

    @Test
    void malformedJsonDataValuesReturnsEmptyContext() {
        final ExpressionContext ctx = EventExpressionContext.of(json,
                null, "not-json",
                LocalDate.of(2026, 11, 10), "OU-A", "ACTIVE");
        assertThat(new Evaluator(ctx).eval(Parser.parse("#{DE1}")))
                .isNull();
    }

    @Test
    void endToEndIfConditionalOnDataValue() {
        final ExpressionContext ctx = EventExpressionContext.of(json,
                null, "{\"BMI\":32}",
                LocalDate.of(2026, 11, 10), "OU-A", "COMPLETED");
        final Object v = new Evaluator(ctx).eval(
                Parser.parse("if(#{BMI} >= 30, 1, 0)"));
        assertThat(v).isEqualTo(new BigDecimal("1"));
    }
}
