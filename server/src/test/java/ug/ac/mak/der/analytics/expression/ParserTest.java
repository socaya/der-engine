package ug.ac.mak.der.analytics.expression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class ParserTest {

    @Test
    void numberLiteralParses() {
        assertThat(Parser.parse("1"))
                .isEqualTo(new Expression.NumberLit(BigDecimal.ONE));
    }

    @Test
    void additionIsLeftAssociative() {
        final Expression e = Parser.parse("1 + 2 + 3");
        assertThat(e).isInstanceOf(Expression.BinaryOp.class);
        final Expression.BinaryOp outer = (Expression.BinaryOp) e;
        assertThat(outer.op()).isEqualTo(
                Expression.BinaryOp.Operator.ADD);
        assertThat(outer.left()).isInstanceOf(Expression.BinaryOp.class);
    }

    @Test
    void multiplicationBindsTighterThanAddition() {
        final Expression.BinaryOp e =
                (Expression.BinaryOp) Parser.parse("1 + 2 * 3");
        assertThat(e.op()).isEqualTo(Expression.BinaryOp.Operator.ADD);
        assertThat(e.right()).isInstanceOf(Expression.BinaryOp.class);
    }

    @Test
    void parenthesesOverridePrecedence() {
        final Expression.BinaryOp e =
                (Expression.BinaryOp) Parser.parse("(1 + 2) * 3");
        assertThat(e.op()).isEqualTo(Expression.BinaryOp.Operator.MUL);
    }

    @Test
    void comparisonAndLogical() {
        final Expression e = Parser.parse("#{DE1} > 0 && #{DE2} < 10");
        assertThat(e).isInstanceOf(Expression.BinaryOp.class);
        assertThat(((Expression.BinaryOp) e).op())
                .isEqualTo(Expression.BinaryOp.Operator.AND);
    }

    @Test
    void referencesParseWithKinds() {
        assertThat(((Expression.Reference) Parser.parse("#{DE1}")).kind())
                .isEqualTo(Expression.Reference.Kind.DATA_ELEMENT);
        assertThat(((Expression.Reference) Parser.parse("A{AT1}")).kind())
                .isEqualTo(Expression.Reference.Kind.ATTRIBUTE);
        assertThat(((Expression.Reference) Parser.parse("V{vv}")).kind())
                .isEqualTo(Expression.Reference.Kind.VARIABLE);
        assertThat(((Expression.Reference) Parser.parse("C{cc}")).kind())
                .isEqualTo(Expression.Reference.Kind.CONSTANT);
    }

    @Test
    void stageQualifiedReferenceSplits() {
        final Expression.Reference r = (Expression.Reference) Parser.parse(
                "#{STG1.DE1}");
        assertThat(r.firstUid()).isEqualTo("STG1");
        assertThat(r.secondUid()).isEqualTo("DE1");
    }

    @Test
    void functionCallParses() {
        final Expression e = Parser.parse("d2:hasValue(#{DE1})");
        assertThat(e).isInstanceOf(Expression.FunctionCall.class);
        assertThat(((Expression.FunctionCall) e).name())
                .isEqualTo("d2:hasValue");
    }

    @Test
    void ifIsRecognisedAsSpecialForm() {
        final Expression e = Parser.parse("if(#{DE1} > 0, 1, 0)");
        assertThat(e).isInstanceOf(Expression.If.class);
    }

    @Test
    void ifArityIsChecked() {
        assertThatThrownBy(() -> Parser.parse("if(#{DE1})"))
                .isInstanceOf(Parser.ParseException.class)
                .hasMessageContaining("3 arguments");
    }

    @Test
    void unaryMinusParses() {
        final Expression e = Parser.parse("-5");
        assertThat(e).isInstanceOf(Expression.UnaryOp.class);
    }

    @Test
    void bareIdentifierRejected() {
        assertThatThrownBy(() -> Parser.parse("foo + 1"))
                .isInstanceOf(Parser.ParseException.class)
                .hasMessageContaining("bare identifier");
    }

    @Test
    void unexpectedEof() {
        assertThatThrownBy(() -> Parser.parse("1 +"))
                .isInstanceOf(Parser.ParseException.class);
    }

    @Test
    void literalsBoolAndNull() {
        assertThat(Parser.parse("true")).isEqualTo(
                new Expression.BoolLit(true));
        assertThat(Parser.parse("null")).isEqualTo(
                new Expression.NullLit());
    }
}
