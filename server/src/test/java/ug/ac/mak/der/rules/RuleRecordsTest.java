package ug.ac.mak.der.rules;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class RuleRecordsTest {

    @Test
    void tokenAccessors() {
        final RuleToken t = new RuleToken(RuleToken.RuleTokenType.NUMBER, "1", 0);
        assertThat(t.type()).isEqualTo(RuleToken.RuleTokenType.NUMBER);
        assertThat(t.text()).isEqualTo("1");
        assertThat(t.position()).isEqualTo(0);
    }

    @Test
    void engineResultRejectedWhenErrors() {
        final var r = new RuleEngineResult(Map.of("a", 1),
                List.of(new RuleEngineResult.RuleMessage("r1", "a", "boom")),
                List.of());
        assertThat(r.rejected()).isTrue();
        assertThat(r.assigned()).hasSize(1);
        assertThat(r.errors()).hasSize(1);
    }

    @Test
    void engineResultOkWhenEmpty() {
        final var r = new RuleEngineResult(Map.of(), List.of(), List.of());
        assertThat(r.rejected()).isFalse();
    }

    @Test
    void engineResultRejectsNulls() {
        assertThatThrownBy(() -> new RuleEngineResult(null, List.of(), List.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new RuleEngineResult(Map.of(), null, List.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new RuleEngineResult(Map.of(), List.of(), null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void astRecords() {
        assertThat(new RuleAst.NumberLit(1.5).value()).isEqualTo(1.5);
        assertThat(new RuleAst.StringLit("x").value()).isEqualTo("x");
        assertThat(new RuleAst.BoolLit(true).value()).isTrue();
        assertThat(new RuleAst.NullLit()).isNotNull();
        assertThat(new RuleAst.AttributeRef("a").uid()).isEqualTo("a");
        assertThat(new RuleAst.ConstantRef("c").uid()).isEqualTo("c");
        assertThat(new RuleAst.VariableRef("v").name()).isEqualTo("v");
        assertThat(new RuleAst.DataElementRef("ps", "de").programStageUid()).isEqualTo("ps");
        assertThat(new RuleAst.Unary("-", new RuleAst.NumberLit(1)).op()).isEqualTo("-");
        assertThat(new RuleAst.Binary("+", new RuleAst.NumberLit(1),
                new RuleAst.NumberLit(2)).op()).isEqualTo("+");
        assertThat(new RuleAst.Ternary(new RuleAst.BoolLit(true),
                new RuleAst.NumberLit(1), new RuleAst.NumberLit(2))).isNotNull();
        assertThat(new RuleAst.D2Call("f", List.of()).name()).isEqualTo("f");
    }

    @Test
    void parseExceptionCarriesMessage() {
        final var ex = new RuleParseException("boom");
        assertThat(ex.getMessage()).isEqualTo("boom");
    }
}
