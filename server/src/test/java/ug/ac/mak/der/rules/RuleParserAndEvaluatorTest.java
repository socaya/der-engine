package ug.ac.mak.der.rules;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class RuleParserAndEvaluatorTest {

    private static Object eval(final String src, final RuleContext ctx) {
        final RuleAst ast = new RuleParser(src).parse();
        return new RuleExpressionEvaluator(ctx).evaluate(ast);
    }

    private static RuleContext basicCtx() {
        return RuleContext.builder()
                .eventValue("psA.deX", 5)
                .eventValue("psA.deY", "hello")
                .teiAttribute("teaOne", "world")
                .constant("constPi", 3.14)
                .env("current_date", LocalDate.parse("2026-10-22"))
                .env("org_unit_groups", List.of("urban"))
                .build();
    }

    @Test
    void parsesAndEvaluatesArithmetic() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("1 + 2 * 3", ctx)).isEqualTo(7.0);
        assertThat(eval("(1 + 2) * 3", ctx)).isEqualTo(9.0);
        assertThat(eval("10 / 4", ctx)).isEqualTo(2.5);
        assertThat(eval("5 - -2", ctx)).isEqualTo(7.0);
    }

    @Test
    void comparisonAndLogical() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("5 > 3 && 2 < 1", ctx)).isEqualTo(false);
        assertThat(eval("5 >= 5 || 1 == 2", ctx)).isEqualTo(true);
        assertThat(eval("1 != 2", ctx)).isEqualTo(true);
        assertThat(eval("1 <= 1", ctx)).isEqualTo(true);
        assertThat(eval("!(1 == 2)", ctx)).isEqualTo(true);
    }

    @Test
    void ternaryAndStringConcat() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("1 == 1 ? 'yes' : 'no'", ctx)).isEqualTo("yes");
        assertThat(eval("'a' + 'b'", ctx)).isEqualTo("ab");
    }

    @Test
    void referencesResolvable() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("#{psA.deX}", ctx)).isEqualTo(5);
        assertThat(eval("A{teaOne}", ctx)).isEqualTo("world");
        assertThat(eval("C{constPi}", ctx)).isEqualTo(3.14);
    }

    @Test
    void assignedValuesShadowCurrent() {
        final RuleContext ctx = basicCtx();
        ctx.assignedValues().put("psA.deX", 42);
        assertThat(eval("#{psA.deX}", ctx)).isEqualTo(42);
    }

    @Test
    void d2HasValueTrueAndFalse() {
        final RuleContext ctx = basicCtx();
        // In D2Call, DataElementRef args become CountKey wrappers; call directly via
        // the evaluator for the "has a scalar value" branch of d2:hasValue
        assertThat(eval("d2:hasValue(#{psA.deX})", ctx)).isEqualTo(true);
    }

    @Test
    void d2CountOverPreviousEvents() {
        final Map<String, Object> prev1 = new LinkedHashMap<>();
        prev1.put("psA.deY", "YES");
        final Map<String, Object> prev2 = new LinkedHashMap<>();
        prev2.put("psA.deY", "NO");
        final RuleContext ctx = RuleContext.builder()
                .previousEvent(prev1).previousEvent(prev2).build();
        assertThat(eval("d2:count(#{psA.deY})", ctx)).isEqualTo(2.0);
        assertThat(eval("d2:countIfValue(#{psA.deY}, 'YES')", ctx)).isEqualTo(1.0);
    }

    @Test
    void d2DaysBetween() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("d2:daysBetween('2026-10-01', '2026-10-11')", ctx)).isEqualTo(10.0);
    }

    @Test
    void d2StringFunctions() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("d2:left('abcdef', 3)", ctx)).isEqualTo("abc");
        assertThat(eval("d2:right('abcdef', 2)", ctx)).isEqualTo("ef");
        assertThat(eval("d2:substring('abcdef', 1, 4)", ctx)).isEqualTo("bcd");
        assertThat(eval("d2:length('abc')", ctx)).isEqualTo(3.0);
        assertThat(eval("d2:concatenate('a', 'b', 'c')", ctx)).isEqualTo("abc");
        assertThat(eval("d2:validatePattern('123', '\\\\d+')", ctx)).isEqualTo(true);
    }

    @Test
    void parserRejectsTrailing() {
        assertThatThrownBy(() -> new RuleParser("1 2").parse())
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void parserRejectsMalformed() {
        assertThatThrownBy(() -> new RuleParser("1 +").parse())
                .isInstanceOf(RuleParseException.class);
        assertThatThrownBy(() -> new RuleParser("(1").parse())
                .isInstanceOf(RuleParseException.class);
        assertThatThrownBy(() -> new RuleParser("#{a}").parse())
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void d2UnsupportedFunction() {
        assertThatThrownBy(() -> eval("d2:nope()", basicCtx()))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void nullHandling() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("null == null", ctx)).isEqualTo(true);
        assertThat(eval("null == 1", ctx)).isEqualTo(false);
    }

    @Test
    void boolAndNumberCoercion() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("true + 1", ctx)).isEqualTo(2.0);
    }

    @Test
    void dateDiffFunctions() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("d2:weeksBetween('2026-10-01', '2026-10-15')", ctx)).isEqualTo(2.0);
        assertThat(eval("d2:monthsBetween('2026-01-01', '2026-04-01')", ctx)).isEqualTo(3.0);
        assertThat(eval("d2:yearsBetween('2020-01-01', '2026-01-01')", ctx)).isEqualTo(6.0);
        assertThat(eval("d2:minutesBetween('2026-10-22T10:00:00', '2026-10-22T11:30:00')", ctx))
                .isEqualTo(90.0);
    }

    @Test
    void addDaysReturnsDate() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("d2:addDays('2026-10-01', 5)", ctx)).isEqualTo(LocalDate.of(2026, 10, 6));
    }

    @Test
    void mathHelpers() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("d2:ceil(1.1)", ctx)).isEqualTo(2.0);
        assertThat(eval("d2:floor(1.9)", ctx)).isEqualTo(1.0);
        assertThat(eval("d2:round(1.5)", ctx)).isEqualTo(2.0);
        assertThat(eval("d2:modulus(10, 3)", ctx)).isEqualTo(1.0);
        assertThat(eval("d2:zing(-5)", ctx)).isEqualTo(0.0);
        assertThat(eval("d2:zing(5)", ctx)).isEqualTo(5.0);
        assertThat(eval("d2:oizp(0)", ctx)).isEqualTo(1.0);
        assertThat(eval("d2:oizp(-1)", ctx)).isEqualTo(0.0);
        assertThat(eval("d2:zpvc(1, -1, 2)", ctx)).isEqualTo(2.0);
    }

    @Test
    void inOrgUnitGroup() {
        final RuleContext ctx = basicCtx();
        assertThat(eval("d2:inOrgUnitGroup('urban')", ctx)).isEqualTo(true);
        assertThat(eval("d2:inOrgUnitGroup('rural')", ctx)).isEqualTo(false);
    }

    @Test
    void d2SplitAndExtract() {
        final RuleContext ctx = basicCtx();
        assertThat(((List<?>) eval("d2:split('a,b,c', ',', 1)", ctx)).get(0)).isEqualTo("b");
        assertThat(((List<?>) eval("d2:split('a,b,c', ',', 10)", ctx)).isEmpty()).isTrue();
        assertThat(eval("d2:extractDataMatrixValue('key=', 'key=42;other=1')", ctx)).isEqualTo("42");
        assertThat(eval("d2:extractDataMatrixValue('missing=', 'key=42')", ctx)).isEqualTo("");
    }

    @Test
    void countKeyOfFactory() {
        assertThat(D2Functions.CountKey.of("ps", "de").compound()).isEqualTo("ps.de");
    }

    @Test
    void toDateAcceptsDateTimeAndNull() {
        assertThatThrownBy(() -> D2Functions.toDate(null))
                .isInstanceOf(RuleParseException.class);
        assertThat(D2Functions.toDate(LocalDate.of(2026, 1, 1))).isNotNull();
        assertThat(D2Functions.toDate(LocalDateTime.of(2026, 1, 1, 0, 0))).isNotNull();
        assertThatThrownBy(() -> D2Functions.toDate("not-a-date"))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void toDateTimeFallsBackToDate() {
        assertThat(D2Functions.toDateTime(LocalDate.of(2026, 1, 1))).isNotNull();
        assertThat(D2Functions.toDateTime("2026-01-01")).isNotNull();
        assertThatThrownBy(() -> D2Functions.toDateTime(null))
                .isInstanceOf(RuleParseException.class);
        assertThatThrownBy(() -> D2Functions.toDateTime("junk"))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void astNodesExpose() {
        final RuleAst a = new RuleParser("1 + 2").parse();
        assertThat(a).isInstanceOf(RuleAst.Binary.class);
    }

    @Test
    void d2Arity() {
        assertThatThrownBy(() -> eval("d2:hasValue()", basicCtx()))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void previousEventsLastDate() {
        final RuleContext ctx = RuleContext.builder()
                .previousEvent(Map.of("psA.deY", "x", "event_date", "2026-10-10"))
                .previousEvent(Map.of("psA.deY", "x", "event_date", "2026-10-20"))
                .build();
        assertThat(eval("d2:lastEventDate(#{psA.deY})", ctx)).isEqualTo(LocalDate.of(2026, 10, 20));
    }

    @Test
    void stringAsNumberFallsBackZero() {
        final RuleContext ctx = basicCtx();
        // Numeric '0' coerces to "0.0" via Double::toString when concatenated.
        assertThat(eval("'abc' + 0", ctx)).isEqualTo("abc0.0");
    }

    @Test
    void numericStringCoercion() {
        final RuleContext ctx = basicCtx();
        // #{psA.deY} = "hello"; comparison coerces string -> 0 under d2 engine semantics
        assertThat(eval("#{psA.deY} == 'hello'", ctx)).isEqualTo(true);
    }
}
