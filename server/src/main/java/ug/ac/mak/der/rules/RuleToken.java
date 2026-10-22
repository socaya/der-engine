package ug.ac.mak.der.rules;

/** Token emitted by the hand-written {@link RuleLexer}. */
public record RuleToken(RuleTokenType type, String text, int position) {

    public enum RuleTokenType {
        NUMBER, STRING, IDENT, DOT, LPAREN, RPAREN, COMMA, PLUS, MINUS, STAR, SLASH,
        EQ, NEQ, LT, GT, LTE, GTE, AND, OR, NOT, QUESTION, COLON, TRUE, FALSE, NULL,
        REF_ATTRIBUTE, REF_DATA_ELEMENT, REF_CONSTANT, REF_VARIABLE,
        D2_FUNCTION, EOF
    }
}
