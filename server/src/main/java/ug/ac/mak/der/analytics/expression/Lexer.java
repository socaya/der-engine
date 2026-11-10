package ug.ac.mak.der.analytics.expression;

import java.util.ArrayList;
import java.util.List;

/**
 * Lexer for DHIS2 program indicator expressions.
 *
 * <p>Deliberately strict: anything that isn't part of the documented
 * grammar is a {@link LexException}. This supports AN-FR-004 — the
 * engine must never silently return zero for malformed inputs.</p>
 */
public final class Lexer {

    private final String src;
    private int pos;

    public Lexer(final String src) {
        this.src = src == null ? "" : src;
    }

    public static List<Token> tokenise(final String src) {
        return new Lexer(src).all();
    }

    public List<Token> all() {
        final List<Token> out = new ArrayList<>();
        while (true) {
            skipWhitespace();
            if (pos >= src.length()) {
                out.add(new Token(Token.Kind.EOF, "", pos));
                return out;
            }
            out.add(next());
        }
    }

    private Token next() {
        final int start = pos;
        final char c = src.charAt(pos);

        if (c == '#' || c == 'A' || c == 'V' || c == 'C') {
            // Reference prefix — look ahead for '{'.
            if (pos + 1 < src.length() && src.charAt(pos + 1) == '{') {
                return reference(c, start);
            }
            // 'A', 'V', 'C' otherwise could begin an identifier
            // (e.g. keyword, function name). Fall through to ident.
            if (c == '#') {
                throw new LexException("stray '#' at " + pos);
            }
        }
        if (Character.isDigit(c) || (c == '.'
                && pos + 1 < src.length()
                && Character.isDigit(src.charAt(pos + 1)))) {
            return number(start);
        }
        if (c == '\'' || c == '"') {
            return stringLit(c, start);
        }
        if (Character.isLetter(c) || c == '_') {
            return identOrKeyword(start);
        }
        return punctuation(c, start);
    }

    private Token reference(final char prefix, final int start) {
        // Consume the prefix letter + '{'.
        pos += 2;
        final int bodyStart = pos;
        while (pos < src.length() && src.charAt(pos) != '}') {
            pos++;
        }
        if (pos >= src.length()) {
            throw new LexException(
                    "unterminated reference '" + prefix + "{' at " + start);
        }
        final String body = src.substring(bodyStart, pos);
        pos++; // consume '}'
        final Token.Kind kind = switch (prefix) {
            case '#' -> Token.Kind.REF_DATA_ELEMENT;
            case 'A' -> Token.Kind.REF_ATTRIBUTE;
            case 'V' -> Token.Kind.REF_VARIABLE;
            case 'C' -> Token.Kind.REF_CONSTANT;
            default -> throw new LexException(
                    "unexpected reference prefix '" + prefix + "'");
        };
        return new Token(kind, body.trim(), start);
    }

    private Token number(final int start) {
        while (pos < src.length() && (Character.isDigit(src.charAt(pos))
                || src.charAt(pos) == '.')) {
            pos++;
        }
        return new Token(Token.Kind.NUMBER,
                src.substring(start, pos), start);
    }

    private Token stringLit(final char quote, final int start) {
        pos++; // opening quote
        final StringBuilder b = new StringBuilder();
        while (pos < src.length() && src.charAt(pos) != quote) {
            if (src.charAt(pos) == '\\' && pos + 1 < src.length()) {
                b.append(src.charAt(pos + 1));
                pos += 2;
            } else {
                b.append(src.charAt(pos));
                pos++;
            }
        }
        if (pos >= src.length()) {
            throw new LexException(
                    "unterminated string literal at " + start);
        }
        pos++; // closing quote
        return new Token(Token.Kind.STRING, b.toString(), start);
    }

    private Token identOrKeyword(final int start) {
        while (pos < src.length() && (Character.isLetterOrDigit(src.charAt(pos))
                || src.charAt(pos) == '_' || src.charAt(pos) == ':')) {
            pos++;
        }
        final String text = src.substring(start, pos);
        return switch (text) {
            case "true" -> new Token(Token.Kind.BOOL_TRUE, text, start);
            case "false" -> new Token(Token.Kind.BOOL_FALSE, text, start);
            case "null" -> new Token(Token.Kind.NULL, text, start);
            case "and" -> new Token(Token.Kind.AND, text, start);
            case "or" -> new Token(Token.Kind.OR, text, start);
            case "not" -> new Token(Token.Kind.NOT, text, start);
            default -> new Token(Token.Kind.IDENT, text, start);
        };
    }

    private Token punctuation(final char c, final int start) {
        switch (c) {
            case '(':
                pos++;
                return new Token(Token.Kind.LPAREN, "(", start);
            case ')':
                pos++;
                return new Token(Token.Kind.RPAREN, ")", start);
            case ',':
                pos++;
                return new Token(Token.Kind.COMMA, ",", start);
            case '+':
                pos++;
                return new Token(Token.Kind.PLUS, "+", start);
            case '-':
                pos++;
                return new Token(Token.Kind.MINUS, "-", start);
            case '*':
                pos++;
                return new Token(Token.Kind.STAR, "*", start);
            case '/':
                pos++;
                return new Token(Token.Kind.SLASH, "/", start);
            case '%':
                pos++;
                return new Token(Token.Kind.PERCENT, "%", start);
            case '=':
                pos++;
                if (pos < src.length() && src.charAt(pos) == '=') {
                    pos++;
                }
                return new Token(Token.Kind.EQ, "==", start);
            case '!':
                pos++;
                if (pos < src.length() && src.charAt(pos) == '=') {
                    pos++;
                    return new Token(Token.Kind.NEQ, "!=", start);
                }
                return new Token(Token.Kind.NOT, "!", start);
            case '<':
                pos++;
                if (pos < src.length() && src.charAt(pos) == '=') {
                    pos++;
                    return new Token(Token.Kind.LTE, "<=", start);
                }
                return new Token(Token.Kind.LT, "<", start);
            case '>':
                pos++;
                if (pos < src.length() && src.charAt(pos) == '=') {
                    pos++;
                    return new Token(Token.Kind.GTE, ">=", start);
                }
                return new Token(Token.Kind.GT, ">", start);
            case '&':
                pos++;
                if (pos < src.length() && src.charAt(pos) == '&') {
                    pos++;
                    return new Token(Token.Kind.AND, "&&", start);
                }
                throw new LexException(
                        "expected '&&' at " + start);
            case '|':
                pos++;
                if (pos < src.length() && src.charAt(pos) == '|') {
                    pos++;
                    return new Token(Token.Kind.OR, "||", start);
                }
                throw new LexException(
                        "expected '||' at " + start);
            default:
                throw new LexException(
                        "unexpected character '" + c + "' at " + start);
        }
    }

    private void skipWhitespace() {
        while (pos < src.length() && Character.isWhitespace(src.charAt(pos))) {
            pos++;
        }
    }

    /** Thrown on any lex-time error. The server catches and surfaces
     *  this as support_state=UNSUPPORTED with the diagnostic text. */
    public static final class LexException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public LexException(final String message) {
            super(message);
        }
    }
}
