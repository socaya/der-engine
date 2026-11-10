package ug.ac.mak.der.analytics.expression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

class LexerTest {

    @Test
    void tokenisesNumbersAndIdentifiers() {
        final List<Token> ts = Lexer.tokenise("1 + 2.5 * foo");
        assertThat(ts).extracting(Token::kind).containsExactly(
                Token.Kind.NUMBER, Token.Kind.PLUS,
                Token.Kind.NUMBER, Token.Kind.STAR,
                Token.Kind.IDENT, Token.Kind.EOF);
        assertThat(ts.get(0).text()).isEqualTo("1");
        assertThat(ts.get(2).text()).isEqualTo("2.5");
    }

    @Test
    void tokenisesReferencePrefixes() {
        final List<Token> ts = Lexer.tokenise("#{DE1} + A{AT1} + V{event_date}");
        assertThat(ts).extracting(Token::kind).contains(
                Token.Kind.REF_DATA_ELEMENT,
                Token.Kind.REF_ATTRIBUTE,
                Token.Kind.REF_VARIABLE);
        assertThat(ts.get(0).text()).isEqualTo("DE1");
        assertThat(ts.get(2).text()).isEqualTo("AT1");
        assertThat(ts.get(4).text()).isEqualTo("event_date");
    }

    @Test
    void tokenisesStageQualifiedRef() {
        final List<Token> ts = Lexer.tokenise("#{STG1.DE1}");
        assertThat(ts.get(0).kind()).isEqualTo(Token.Kind.REF_DATA_ELEMENT);
        assertThat(ts.get(0).text()).isEqualTo("STG1.DE1");
    }

    @Test
    void tokenisesConstants() {
        final List<Token> ts = Lexer.tokenise("C{CONST1}");
        assertThat(ts.get(0).kind()).isEqualTo(Token.Kind.REF_CONSTANT);
    }

    @Test
    void tokenisesOperatorsIncludingCompound() {
        final List<Token> ts = Lexer.tokenise("1 >= 2 || 3 <= 4 && 5 != 6");
        assertThat(ts).extracting(Token::kind).contains(
                Token.Kind.GTE, Token.Kind.OR,
                Token.Kind.LTE, Token.Kind.AND,
                Token.Kind.NEQ);
    }

    @Test
    void tokenisesKeywordsAndLiterals() {
        final List<Token> ts = Lexer.tokenise("true and not false or null");
        assertThat(ts).extracting(Token::kind).containsExactly(
                Token.Kind.BOOL_TRUE, Token.Kind.AND,
                Token.Kind.NOT, Token.Kind.BOOL_FALSE,
                Token.Kind.OR, Token.Kind.NULL,
                Token.Kind.EOF);
    }

    @Test
    void tokenisesStringLiterals() {
        final List<Token> ts = Lexer.tokenise("'hello' + \"world\"");
        assertThat(ts.get(0).kind()).isEqualTo(Token.Kind.STRING);
        assertThat(ts.get(0).text()).isEqualTo("hello");
        assertThat(ts.get(2).text()).isEqualTo("world");
    }

    @Test
    void stringEscapes() {
        final List<Token> ts = Lexer.tokenise("'it\\'s'");
        assertThat(ts.get(0).text()).isEqualTo("it's");
    }

    @Test
    void rejectsUnterminatedReference() {
        assertThatThrownBy(() -> Lexer.tokenise("#{DE1 + 1"))
                .isInstanceOf(Lexer.LexException.class)
                .hasMessageContaining("unterminated");
    }

    @Test
    void rejectsStrayHash() {
        assertThatThrownBy(() -> Lexer.tokenise("# nope"))
                .isInstanceOf(Lexer.LexException.class)
                .hasMessageContaining("stray '#'");
    }

    @Test
    void rejectsSingleAmpersand() {
        assertThatThrownBy(() -> Lexer.tokenise("a & b"))
                .isInstanceOf(Lexer.LexException.class);
    }

    @Test
    void functionNameAllowsColon() {
        final List<Token> ts = Lexer.tokenise("d2:hasValue(#{DE1})");
        assertThat(ts.get(0).text()).isEqualTo("d2:hasValue");
        assertThat(ts.get(0).kind()).isEqualTo(Token.Kind.IDENT);
    }
}
