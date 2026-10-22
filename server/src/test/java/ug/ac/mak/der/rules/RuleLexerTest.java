package ug.ac.mak.der.rules;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.rules.RuleToken.RuleTokenType;

class RuleLexerTest {

    private static List<RuleToken> tok(final String src) {
        return new RuleLexer(src).tokenise();
    }

    @Test
    void tokenisesLiteralsAndOperators() {
        final List<RuleToken> t = tok("1 + 2.5 - 'hi' * \"ho\" / 3");
        assertThat(t.get(0).type()).isEqualTo(RuleTokenType.NUMBER);
        assertThat(t.get(1).type()).isEqualTo(RuleTokenType.PLUS);
        assertThat(t.get(2).text()).isEqualTo("2.5");
        assertThat(t.get(3).type()).isEqualTo(RuleTokenType.MINUS);
        assertThat(t.get(4).text()).isEqualTo("hi");
        assertThat(t.get(5).type()).isEqualTo(RuleTokenType.STAR);
        assertThat(t.get(6).text()).isEqualTo("ho");
        assertThat(t.get(7).type()).isEqualTo(RuleTokenType.SLASH);
        assertThat(t.get(9).type()).isEqualTo(RuleTokenType.EOF);
    }

    @Test
    void tokenisesReferences() {
        final List<RuleToken> t = tok("A{teaX} + #{psY.deZ} + C{constK} + V{current_date}");
        assertThat(t.get(0).type()).isEqualTo(RuleTokenType.REF_ATTRIBUTE);
        assertThat(t.get(0).text()).isEqualTo("teaX");
        assertThat(t.get(2).type()).isEqualTo(RuleTokenType.REF_DATA_ELEMENT);
        assertThat(t.get(2).text()).isEqualTo("psY.deZ");
        assertThat(t.get(4).type()).isEqualTo(RuleTokenType.REF_CONSTANT);
        assertThat(t.get(6).type()).isEqualTo(RuleTokenType.REF_VARIABLE);
    }

    @Test
    void tokenisesComparisonAndLogical() {
        final List<RuleToken> t = tok("x == y && (a <= b || c >= d) != z");
        assertThat(t.stream().map(RuleToken::type)).contains(RuleTokenType.EQ,
                RuleTokenType.AND, RuleTokenType.LTE, RuleTokenType.OR, RuleTokenType.GTE,
                RuleTokenType.NEQ);
    }

    @Test
    void tokenisesTernaryAndNegation() {
        final List<RuleToken> t = tok("!x < 10 ? -1 : 2");
        assertThat(t.get(0).type()).isEqualTo(RuleTokenType.NOT);
        assertThat(t.get(1).type()).isEqualTo(RuleTokenType.IDENT);
        assertThat(t.stream().map(RuleToken::type)).contains(RuleTokenType.QUESTION,
                RuleTokenType.COLON);
    }

    @Test
    void tokenisesD2Call() {
        final List<RuleToken> t = tok("d2:hasValue(#{a.b})");
        assertThat(t.get(0).type()).isEqualTo(RuleTokenType.D2_FUNCTION);
        assertThat(t.get(0).text()).isEqualTo("hasValue");
    }

    @Test
    void tokenisesBoolAndNull() {
        final List<RuleToken> t = tok("true && false || null");
        assertThat(t.get(0).type()).isEqualTo(RuleTokenType.TRUE);
        assertThat(t.get(2).type()).isEqualTo(RuleTokenType.FALSE);
        assertThat(t.get(4).type()).isEqualTo(RuleTokenType.NULL);
    }

    @Test
    void tokenisesStringWithEscape() {
        final List<RuleToken> t = tok("'a\\'b'");
        assertThat(t.get(0).type()).isEqualTo(RuleTokenType.STRING);
        assertThat(t.get(0).text()).isEqualTo("a'b");
    }

    @Test
    void tokenisesIdentifierThatIsNotKeyword() {
        final List<RuleToken> t = tok("foo_bar");
        assertThat(t.get(0).type()).isEqualTo(RuleTokenType.IDENT);
        assertThat(t.get(0).text()).isEqualTo("foo_bar");
    }

    @Test
    void unterminatedStringThrows() {
        assertThatThrownBy(() -> tok("'oops"))
                .isInstanceOf(RuleParseException.class)
                .hasMessageContaining("unterminated");
    }

    @Test
    void unterminatedReferenceThrows() {
        assertThatThrownBy(() -> tok("A{oops"))
                .isInstanceOf(RuleParseException.class)
                .hasMessageContaining("unterminated");
    }

    @Test
    void unexpectedChar() {
        assertThatThrownBy(() -> tok("@"))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void unexpectedBraceWithoutPrefix() {
        assertThatThrownBy(() -> tok("{bad}"))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void unexpectedAmpersand() {
        assertThatThrownBy(() -> tok("a & b"))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void unexpectedPipe() {
        assertThatThrownBy(() -> tok("a | b"))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void dotAndCommaAndParensEmitted() {
        final List<RuleToken> t = tok("f(a.b, 1)");
        assertThat(t.stream().map(RuleToken::type)).contains(
                RuleTokenType.LPAREN, RuleTokenType.DOT, RuleTokenType.COMMA, RuleTokenType.RPAREN);
    }

    @Test
    void singleEqAssignable() {
        final List<RuleToken> t = tok("a = b");
        assertThat(t.get(1).type()).isEqualTo(RuleTokenType.EQ);
    }

    @Test
    void leadingDotNumeric() {
        final List<RuleToken> t = tok(".5");
        assertThat(t.get(0).type()).isEqualTo(RuleTokenType.NUMBER);
    }

    @Test
    void d2WithoutNameFails() {
        assertThatThrownBy(() -> tok("d2:("))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void refPrefixCharactersAsIdentifiers() {
        // 'A', '#', 'C', 'V', 'd' as first character without the specific
        // follow-up tokens must fall through to the identifier/operator branches.
        final List<RuleToken> aIdent = tok("A1");
        assertThat(aIdent.get(0).type()).isEqualTo(RuleTokenType.IDENT);
        final List<RuleToken> cIdent = tok("C1");
        assertThat(cIdent.get(0).type()).isEqualTo(RuleTokenType.IDENT);
        final List<RuleToken> vIdent = tok("Vxyz");
        assertThat(vIdent.get(0).type()).isEqualTo(RuleTokenType.IDENT);
        final List<RuleToken> dIdent = tok("date");
        assertThat(dIdent.get(0).type()).isEqualTo(RuleTokenType.IDENT);
        final List<RuleToken> dColon = tok("d1");
        assertThat(dColon.get(0).type()).isEqualTo(RuleTokenType.IDENT);
        final List<RuleToken> underscore = tok("_foo");
        assertThat(underscore.get(0).type()).isEqualTo(RuleTokenType.IDENT);
    }

    @Test
    void hashWithoutBraceIsUnexpected() {
        assertThatThrownBy(() -> tok("#x"))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void peekAtEndReturnsNullChar() {
        // When the source ends on a reference-prefix char, the lexer falls through
        // to identOrKeyword; `A` becomes a plain IDENT.
        final List<RuleToken> t = tok("A");
        assertThat(t.get(0).type()).isEqualTo(RuleTokenType.IDENT);
    }
}
