package ug.ac.mak.der.analytics.expression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.Test;

class EvaluatorTest {

    private Object eval(final String src,
                         final Map<String, Object> de,
                         final Map<String, Object> at,
                         final Map<String, Object> vars) {
        final ExpressionContext ctx = ExpressionContext.of(
                de, at, vars, Map.of());
        return new Evaluator(ctx).eval(Parser.parse(src));
    }

    private Object eval(final String src) {
        return eval(src, Map.of(), Map.of(), Map.of());
    }

    @Test
    void numericLiteral() {
        assertThat(eval("42")).isEqualTo(new BigDecimal("42"));
    }

    @Test
    void arithmetic() {
        assertThat(eval("1 + 2 * 3")).isEqualTo(new BigDecimal("7"));
        assertThat(eval("10 / 4")).isEqualTo(new BigDecimal(
                "2.5"));
    }

    @Test
    void divisionByZeroReturnsNull() {
        assertThat(eval("1 / 0")).isNull();
    }

    @Test
    void comparison() {
        assertThat(eval("5 > 3")).isEqualTo(true);
        assertThat(eval("5 <= 5")).isEqualTo(true);
        assertThat(eval("5 != 3")).isEqualTo(true);
    }

    @Test
    void booleanOps() {
        assertThat(eval("true and false")).isEqualTo(false);
        assertThat(eval("true or false")).isEqualTo(true);
        assertThat(eval("not false")).isEqualTo(true);
    }

    @Test
    void referenceResolution() {
        final Object v = eval("#{DE1} + 1",
                Map.of("DE1", 10), Map.of(), Map.of());
        assertThat(v).isEqualTo(new BigDecimal("11"));
    }

    @Test
    void missingReferencePropagatesNull() {
        final Object v = eval("#{DE1} + 1",
                Map.of(), Map.of(), Map.of());
        assertThat(v).isNull();
    }

    @Test
    void d2HasValue() {
        assertThat(eval("d2:hasValue(#{DE1})",
                Map.of("DE1", 5), Map.of(), Map.of())).isEqualTo(true);
        assertThat(eval("d2:hasValue(#{DE1})",
                Map.of(), Map.of(), Map.of())).isEqualTo(false);
    }

    @Test
    void d2Count() {
        assertThat(eval("d2:count(#{DE1})",
                Map.of("DE1", 5), Map.of(), Map.of()))
                .isEqualTo(BigDecimal.ONE);
        assertThat(eval("d2:count(#{DE1})",
                Map.of(), Map.of(), Map.of()))
                .isEqualTo(BigDecimal.ZERO);
    }

    @Test
    void d2RoundingFunctions() {
        assertThat(eval("d2:ceil(1.1)")).isEqualTo(new BigDecimal("2"));
        assertThat(eval("d2:floor(1.9)")).isEqualTo(new BigDecimal("1"));
        assertThat(eval("d2:round(1.5)")).isEqualTo(new BigDecimal("2"));
    }

    @Test
    void d2ZingAndOizp() {
        assertThat(eval("d2:zing(-3)")).isEqualTo(BigDecimal.ZERO);
        assertThat(eval("d2:zing(5)")).isEqualTo(new BigDecimal("5"));
        assertThat(eval("d2:oizp(0)")).isEqualTo(BigDecimal.ZERO);
        assertThat(eval("d2:oizp(5)")).isEqualTo(BigDecimal.ONE);
        assertThat(eval("d2:oizp(-2)")).isEqualTo(BigDecimal.ZERO);
    }

    @Test
    void d2DaysBetween() {
        final Object v = eval("d2:daysBetween(V{a}, V{b})",
                Map.of(), Map.of(), Map.of(
                        "a", LocalDate.of(2026, 11, 1),
                        "b", LocalDate.of(2026, 11, 10)));
        assertThat(v).isEqualTo(BigDecimal.valueOf(9L));
    }

    @Test
    void d2DaysBetweenAcceptsStringDates() {
        final Object v = eval("d2:daysBetween(V{a}, V{b})",
                Map.of(), Map.of(), Map.of(
                        "a", "2026-11-01", "b", "2026-11-10"));
        assertThat(v).isEqualTo(BigDecimal.valueOf(9L));
    }

    @Test
    void d2YearsBetween() {
        final Object v = eval("d2:yearsBetween(V{a}, V{b})",
                Map.of(), Map.of(), Map.of(
                        "a", LocalDate.of(2000, 1, 1),
                        "b", LocalDate.of(2026, 1, 1)));
        assertThat(v).isEqualTo(BigDecimal.valueOf(26L));
    }

    @Test
    void ifConditional() {
        assertThat(eval("if(#{DE1} > 0, 1, 0)",
                Map.of("DE1", 5), Map.of(), Map.of()))
                .isEqualTo(new BigDecimal("1"));
        assertThat(eval("if(#{DE1} > 0, 1, 0)",
                Map.of("DE1", 0), Map.of(), Map.of()))
                .isEqualTo(new BigDecimal("0"));
    }

    @Test
    void unknownFunctionRejected() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of(), Map.of(), Map.of(), Map.of());
        assertThatThrownBy(() -> new Evaluator(ctx).eval(
                Parser.parse("d2:unknown(1)")))
                .isInstanceOf(Evaluator.EvalException.class)
                .hasMessageContaining("unsupported function");
    }

    @Test
    void unparseableStringToNumberThrows() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of("DE1", "not-a-number"),
                Map.of(), Map.of(), Map.of());
        assertThatThrownBy(() -> new Evaluator(ctx).eval(
                Parser.parse("#{DE1} + 1")))
                .isInstanceOf(Evaluator.EvalException.class);
    }

    @Test
    void equalityAcrossNumericRepresentations() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of("DE1", 1),
                Map.of(), Map.of(), Map.of());
        assertThat(new Evaluator(ctx).eval(Parser.parse("#{DE1} == 1")))
                .isEqualTo(true);
    }

    @Test
    void stringEquality() {
        assertThat(eval("'a' == 'a'")).isEqualTo(true);
        assertThat(eval("'a' == 'b'")).isEqualTo(false);
    }
}
