package ug.ac.mak.der.analytics.expression;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

class ExpressionCompilerTest {

    private final ExpressionCompiler compiler = new ExpressionCompiler();

    @Test
    void readyExpressionCompiles() {
        final ExpressionCompiler.CompileResult r =
                compiler.compile("d2:hasValue(#{DE1}) and A{AT1} > 5");
        assertThat(r.supportState())
                .isEqualTo(ExpressionCompiler.SupportState.READY);
        assertThat(r.parsed()).isTrue();
        assertThat(r.referencedDataElements()).containsExactly("DE1");
        assertThat(r.referencedAttributes()).containsExactly("AT1");
        assertThat(r.referencedFunctions()).containsExactly("d2:hasValue");
    }

    @Test
    void unsupportedFunctionFlagsState() {
        final ExpressionCompiler.CompileResult r =
                compiler.compile("d2:unknownFn(#{DE1})");
        assertThat(r.supportState())
                .isEqualTo(ExpressionCompiler.SupportState.UNSUPPORTED);
        assertThat(r.parsed()).isTrue();
        assertThat(r.diagnostics())
                .anyMatch(s -> s.contains("d2:unknownFn"));
    }

    @Test
    void parseErrorCapturesMessage() {
        final ExpressionCompiler.CompileResult r = compiler.compile("1 +");
        assertThat(r.supportState())
                .isEqualTo(ExpressionCompiler.SupportState.PARSE_ERROR);
        assertThat(r.parsed()).isFalse();
        assertThat(r.diagnostics()).isNotEmpty();
    }

    @Test
    void emptyExpressionIsAParseError() {
        final ExpressionCompiler.CompileResult r = compiler.compile("");
        assertThat(r.supportState())
                .isEqualTo(ExpressionCompiler.SupportState.PARSE_ERROR);
    }

    @Test
    void referencesCollectedAcrossOperators() {
        final ExpressionCompiler.CompileResult r = compiler.compile(
                "#{DE1} + #{STG1.DE2} + A{AT1} + V{vv} + C{cc}");
        assertThat(r.referencedDataElements())
                .containsExactlyInAnyOrder("DE1", "STG1.DE2");
        assertThat(r.referencedAttributes()).containsExactly("AT1");
        assertThat(r.referencedVariables()).containsExactly("vv");
        assertThat(r.referencedConstants()).containsExactly("cc");
    }

    @Test
    void compileAndEvaluateReadyPath() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of("DE1", 10), Map.of(), Map.of(), Map.of());
        assertThat(compiler.compileAndEvaluate("#{DE1} + 1", ctx))
                .isEqualTo(new java.math.BigDecimal("11"));
    }

    @Test
    void compileAndEvaluateUnsupportedReturnsNull() {
        final ExpressionContext ctx = ExpressionContext.of(
                Map.of(), Map.of(), Map.of(), Map.of());
        assertThat(compiler.compileAndEvaluate(
                "d2:unknown(1)", ctx)).isNull();
    }
}
