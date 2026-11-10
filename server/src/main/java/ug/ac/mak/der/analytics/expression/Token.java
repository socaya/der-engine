package ug.ac.mak.der.analytics.expression;

import java.util.Objects;

/**
 * One lexed token in a DHIS2 program-indicator expression.
 *
 * @param kind   semantic category of the lexeme (NUMBER, IDENT, …).
 * @param text   raw characters from the source expression.
 * @param start  zero-based character offset of the first byte of
 *               this token, used for error-position reporting.
 */
public record Token(Kind kind, String text, int start) {

    public Token {
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(text, "text");
    }

    public enum Kind {
        NUMBER, STRING, IDENT,
        /** Reference prefix — '#' (DATA_ELEMENT), 'A' (ATTRIBUTE),
         *  'V' (VARIABLE), 'C' (CONSTANT) followed by '{'. The lexer
         *  returns the REF_* token with the bracketed body already
         *  stripped and set as the token text. */
        REF_DATA_ELEMENT, REF_ATTRIBUTE, REF_VARIABLE, REF_CONSTANT,
        LPAREN, RPAREN, COMMA,
        PLUS, MINUS, STAR, SLASH, PERCENT,
        EQ, NEQ, LT, LTE, GT, GTE,
        AND, OR, NOT,
        /** True / false keywords. */
        BOOL_TRUE, BOOL_FALSE,
        /** null keyword. */
        NULL,
        /** End of input. */
        EOF
    }
}
