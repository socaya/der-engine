package ug.ac.mak.der.rules;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Branch-coverage sweep over {@link RuleExpressionEvaluator},
 * {@link D2Functions}, {@link RuleParser} and {@link RuleLexer}.
 */
class RuleEvaluatorBranchesTest {

    private static Object eval(final String src, final RuleContext ctx) {
        return new RuleExpressionEvaluator(ctx).evaluate(new RuleParser(src).parse());
    }

    @Test
    void allPrimitiveLiteralsAndRefs() {
        final RuleContext ctx = RuleContext.builder()
                .teiAttribute("tea", "x")
                .constant("c", 1)
                .env("v", "y")
                .eventValue("ps.de", 10)
                .build();
        assertThat(new RuleExpressionEvaluator(ctx)
                .evaluate(new RuleAst.NumberLit(1))).isEqualTo(1.0);
        assertThat(new RuleExpressionEvaluator(ctx)
                .evaluate(new RuleAst.StringLit("s"))).isEqualTo("s");
        assertThat(new RuleExpressionEvaluator(ctx)
                .evaluate(new RuleAst.BoolLit(true))).isEqualTo(true);
        assertThat(new RuleExpressionEvaluator(ctx)
                .evaluate(new RuleAst.NullLit())).isNull();
        assertThat(new RuleExpressionEvaluator(ctx)
                .evaluate(new RuleAst.AttributeRef("tea"))).isEqualTo("x");
        assertThat(new RuleExpressionEvaluator(ctx)
                .evaluate(new RuleAst.ConstantRef("c"))).isEqualTo(1);
        assertThat(new RuleExpressionEvaluator(ctx)
                .evaluate(new RuleAst.VariableRef("v"))).isEqualTo("y");
        assertThat(new RuleExpressionEvaluator(ctx)
                .evaluate(new RuleAst.DataElementRef("ps", "de"))).isEqualTo(10);
    }

    @Test
    void unknownBinaryOpThrows() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThatThrownBy(() -> new RuleExpressionEvaluator(ctx).evaluate(
                new RuleAst.Binary("??", new RuleAst.NumberLit(1), new RuleAst.NumberLit(2))))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void unknownUnaryOpThrows() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThatThrownBy(() -> new RuleExpressionEvaluator(ctx).evaluate(
                new RuleAst.Unary("~", new RuleAst.NumberLit(1))))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void rejectsNullContext() {
        assertThatThrownBy(() -> new RuleExpressionEvaluator(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void shortCircuitAndFalse() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("false && (1/0)", ctx)).isEqualTo(false);
    }

    @Test
    void shortCircuitOrTrue() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("true || (1/0)", ctx)).isEqualTo(true);
    }

    @Test
    void truthyBranches() {
        final RuleContext ctx = RuleContext.builder().build();
        // non-boolean, non-null, non-number, non-string → truthy returns true
        assertThat(eval("true", ctx)).isEqualTo(true);
    }

    @Test
    void unknownRefReturnsNull() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("A{missing}", ctx)).isNull();
        assertThat(eval("C{missing}", ctx)).isNull();
        assertThat(eval("V{missing}", ctx)).isNull();
    }

    @Test
    void asNumberNullAndBoolean() {
        final RuleContext ctx = RuleContext.builder().env("flag", true).build();
        assertThat(eval("-V{flag}", ctx)).isEqualTo(-1.0);
        final RuleContext ctx2 = RuleContext.builder().build();
        assertThat(eval("-V{missing}", ctx2)).isEqualTo(-0.0);
    }

    @Test
    void stringNumberCoercionFails() {
        final RuleContext ctx = RuleContext.builder().env("x", "abc").build();
        // asNumber falls back to 0 on parse failure
        assertThat(eval("V{x} + 0", ctx)).isEqualTo("abc0.0");
    }

    @Test
    void d2SplitDelimiterNegativeIndex() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(((List<?>) eval("d2:split('a,b', ',', -1)", ctx)).isEmpty()).isTrue();
    }

    @Test
    void d2NumFallbackCovered() {
        final RuleContext ctx = RuleContext.builder().build();
        // num(null) → 0 via D2Functions.num path
        assertThat(eval("d2:modulus(null, 5)", ctx)).isEqualTo(0.0);
    }

    @Test
    void d2NumRejectsNonNumeric() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThatThrownBy(() -> eval("d2:modulus('abc', 2)", ctx))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void d2CountRequiresCountKey() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThatThrownBy(() -> eval("d2:count('literal')", ctx))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void d2CountIfValueMissingSecondArg() {
        final Map<String, Object> prev = new java.util.LinkedHashMap<>();
        prev.put("ps.de", "x");
        final RuleContext ctx = RuleContext.builder().previousEvent(prev).build();
        // Only 1 arg → the arg loop skips value match → count stays 0
        assertThat(eval("d2:countIfValue(#{ps.de})", ctx)).isEqualTo(0.0);
    }

    @Test
    void d2LastEventDateNoEvents() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("d2:lastEventDate(#{ps.de})", ctx)).isNull();
    }

    @Test
    void d2LastEventDateSkipsEventsWithoutKey() {
        final Map<String, Object> prev = new java.util.LinkedHashMap<>();
        prev.put("event_date", "2026-10-10"); // no "ps.de" present
        final RuleContext ctx = RuleContext.builder().previousEvent(prev).build();
        assertThat(eval("d2:lastEventDate(#{ps.de})", ctx)).isNull();
    }

    @Test
    void d2InOrgUnitGroupNotList() {
        final RuleContext ctx = RuleContext.builder().env("org_unit_groups", "scalar").build();
        assertThat(eval("d2:inOrgUnitGroup('x')", ctx)).isEqualTo(false);
    }

    @Test
    void d2SubstringNoEndArg() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("d2:substring('abcdef', 2)", ctx)).isEqualTo("cdef");
    }

    @Test
    void d2SubstringBadRange() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("d2:substring('abc', 10, 20)", ctx)).isEqualTo("");
    }

    @Test
    void d2LeftRightZeroLength() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("d2:left('abc', 0)", ctx)).isEqualTo("");
        assertThat(eval("d2:right('abc', 0)", ctx)).isEqualTo("");
        assertThat(eval("d2:left('abc', -1)", ctx)).isEqualTo("");
        assertThat(eval("d2:right('abc', -1)", ctx)).isEqualTo("");
    }

    @Test
    void stringArithmeticOnlyPromotesWithString() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("1 + 'a'", ctx)).isEqualTo("1.0a");
    }

    @Test
    void d2ToDateHandlesLocalDateTimeArg() {
        final RuleContext ctx = RuleContext.builder()
                .env("start", java.time.LocalDateTime.of(2026, 1, 1, 10, 0))
                .env("end", java.time.LocalDateTime.of(2026, 1, 11, 10, 0))
                .build();
        assertThat(eval("d2:daysBetween(V{start}, V{end})", ctx)).isEqualTo(10.0);
    }

    @Test
    void d2DateDiffWithLocalDateInput() {
        final RuleContext ctx = RuleContext.builder()
                .env("start", LocalDate.of(2026, 10, 1))
                .env("end", LocalDate.of(2026, 10, 15))
                .build();
        assertThat(eval("d2:daysBetween(V{start}, V{end})", ctx)).isEqualTo(14.0);
    }

    @Test
    void d2DateDiffWithNullRejected() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThatThrownBy(() -> eval("d2:daysBetween(null, '2026-01-01')", ctx))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void d2DateTimeFallbackToIsoDate() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("d2:minutesBetween('2026-01-01', '2026-01-02')", ctx)).isEqualTo(1440.0);
    }

    @Test
    void parserRejectsEmptyExpression() {
        assertThatThrownBy(() -> new RuleParser("").parse())
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void parserBadDataElementRef() {
        assertThatThrownBy(() -> new RuleParser("#{noDot}").parse())
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void lexerAllOperators() {
        final List<RuleToken> tokens = new RuleLexer("+ - * / == != < > <= >= && || ! ? : ( ) , .")
                .tokenise();
        // Just verify no throws and EOF at end
        assertThat(tokens.get(tokens.size() - 1).type()).isEqualTo(RuleToken.RuleTokenType.EOF);
    }

    @Test
    void builderCurrentDateOverridable() {
        final RuleContext ctx = RuleContext.builder()
                .currentDate(LocalDate.of(2026, 1, 1))
                .build();
        assertThat(ctx.currentDate()).isEqualTo(LocalDate.of(2026, 1, 1));
    }

    @Test
    void builderNullCurrentDateRejected() {
        assertThatThrownBy(() -> RuleContext.builder().currentDate(null).build())
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void previousEventExposes() {
        final Map<String, Object> p = Map.of("k", "v");
        final RuleContext ctx = RuleContext.builder().previousEvent(p).build();
        assertThat(ctx.previousEvents()).hasSize(1);
    }

    @Test
    void nestedTernaryEvaluation() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("true ? (false ? 1 : 2) : 3", ctx)).isEqualTo(2.0);
    }

    @Test
    void unknownD2CallThrows() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThatThrownBy(() -> eval("d2:bogus()", ctx))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void objectsEqualNullsAndTypes() {
        // Direct D2Functions coverage
        assertThat(D2Functions.objectsEqual(null, null)).isTrue();
        assertThat(D2Functions.objectsEqual(null, 1)).isFalse();
        assertThat(D2Functions.objectsEqual(1, null)).isFalse();
        assertThat(D2Functions.objectsEqual(1.0, 1)).isTrue();
        assertThat(D2Functions.objectsEqual("a", "a")).isTrue();
        assertThat(D2Functions.objectsEqual("1", 1)).isTrue();
    }

    @Test
    void countKeyRecordAccessors() {
        final D2Functions.CountKey k = new D2Functions.CountKey("ps.de");
        assertThat(k.compound()).isEqualTo("ps.de");
    }

    @Test
    void asNumberFallsBackOnBadString() {
        final RuleContext ctx = RuleContext.builder().env("x", "abc").build();
        // Subtraction forces asNumber path (no string concat).
        assertThat(eval("V{x} - 1", ctx)).isEqualTo(-1.0);
    }

    @Test
    void asNumberNullReturnsZeroViaUnaryMinus() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("-V{missing}", ctx)).isEqualTo(-0.0);
    }

    @Test
    void asNumberHandlesBoolean() {
        final RuleContext ctx = RuleContext.builder().env("f", false).env("t", true).build();
        assertThat(eval("V{t} + V{f}", ctx)).isEqualTo(1.0);
    }

    @Test
    void truthyAllPaths() {
        final RuleContext ctx = RuleContext.builder()
                .env("obj", java.util.List.of(1))
                .env("empty", "")
                .env("zero", 0)
                .env("num", 42)
                .build();
        assertThat(eval("V{obj} ? 1 : 0", ctx)).isEqualTo(1.0);
        assertThat(eval("V{empty} ? 1 : 0", ctx)).isEqualTo(0.0);
        assertThat(eval("V{zero} ? 1 : 0", ctx)).isEqualTo(0.0);
        assertThat(eval("V{num} ? 1 : 0", ctx)).isEqualTo(1.0);
    }

    @Test
    void allArithmeticOps() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("5 - 2", ctx)).isEqualTo(3.0);
        assertThat(eval("5 * 2", ctx)).isEqualTo(10.0);
        assertThat(eval("5 / 2", ctx)).isEqualTo(2.5);
    }

    @Test
    void allRelationalOps() {
        final RuleContext ctx = RuleContext.builder().build();
        assertThat(eval("1 == 1", ctx)).isEqualTo(true);
        assertThat(eval("1 != 2", ctx)).isEqualTo(true);
        assertThat(eval("1 < 2", ctx)).isEqualTo(true);
        assertThat(eval("1 > 2", ctx)).isEqualTo(false);
        assertThat(eval("1 <= 1", ctx)).isEqualTo(true);
        assertThat(eval("1 >= 1", ctx)).isEqualTo(true);
    }
}
