package ug.ac.mak.der.rules;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import ug.ac.mak.der.rules.RuleToken.RuleTokenType;

/**
 * Hand-written lexer for the DHIS2 program-rule expression grammar.
 *
 * <p>Recognises references of the form {@code A{uid}} (TEI attribute),
 * {@code #{psUid.deUid}} (data-element), {@code C{uid}} (constant),
 * {@code V{name}} (environment variable); {@code d2:name} prefixes for
 * function calls; numeric and string literals; boolean + null; and the usual
 * arithmetic/relational/logical operators.</p>
 */
public final class RuleLexer {

    private final String source;
    private int cursor;

    public RuleLexer(final String source) {
        this.source = Objects.requireNonNull(source, "source");
    }

    public List<RuleToken> tokenise() {
        final List<RuleToken> out = new ArrayList<>();
        cursor = 0;
        while (cursor < source.length()) {
            final char c = source.charAt(cursor);
            if (Character.isWhitespace(c)) {
                cursor++;
                continue;
            }
            final int startPos = cursor;
            if (c == '\'' || c == '"') {
                out.add(string(c, startPos));
            } else if (Character.isDigit(c) || (c == '.' && cursor + 1 < source.length()
                    && Character.isDigit(source.charAt(cursor + 1)))) {
                out.add(number(startPos));
            } else if (c == '{') {
                throw new RuleParseException("unexpected '{' at " + startPos
                        + "; references must be prefixed (A{..}, #{..}, C{..}, V{..})");
            } else if (c == '#' && peek(1) == '{') {
                out.add(reference(RuleTokenType.REF_DATA_ELEMENT, 2, startPos));
            } else if (c == 'A' && peek(1) == '{') {
                out.add(reference(RuleTokenType.REF_ATTRIBUTE, 2, startPos));
            } else if (c == 'C' && peek(1) == '{') {
                out.add(reference(RuleTokenType.REF_CONSTANT, 2, startPos));
            } else if (c == 'V' && peek(1) == '{') {
                out.add(reference(RuleTokenType.REF_VARIABLE, 2, startPos));
            } else if (c == 'd' && peek(1) == '2' && peek(2) == ':') {
                out.add(d2Function(startPos));
            } else if (Character.isLetter(c) || c == '_') {
                out.add(identOrKeyword(startPos));
            } else {
                out.add(operator(c, startPos));
            }
        }
        out.add(new RuleToken(RuleTokenType.EOF, "", cursor));
        return out;
    }

    private char peek(final int offset) {
        return cursor + offset < source.length() ? source.charAt(cursor + offset) : '\0';
    }

    private RuleToken string(final char quote, final int startPos) {
        cursor++;
        final StringBuilder sb = new StringBuilder();
        while (cursor < source.length() && source.charAt(cursor) != quote) {
            final char c = source.charAt(cursor);
            if (c == '\\' && cursor + 1 < source.length()) {
                sb.append(source.charAt(cursor + 1));
                cursor += 2;
            } else {
                sb.append(c);
                cursor++;
            }
        }
        if (cursor >= source.length()) {
            throw new RuleParseException("unterminated string literal at " + startPos);
        }
        cursor++;
        return new RuleToken(RuleTokenType.STRING, sb.toString(), startPos);
    }

    private RuleToken number(final int startPos) {
        final StringBuilder sb = new StringBuilder();
        while (cursor < source.length()
                && (Character.isDigit(source.charAt(cursor)) || source.charAt(cursor) == '.')) {
            sb.append(source.charAt(cursor));
            cursor++;
        }
        return new RuleToken(RuleTokenType.NUMBER, sb.toString(), startPos);
    }

    private RuleToken reference(final RuleTokenType type, final int skip, final int startPos) {
        cursor += skip;
        final StringBuilder sb = new StringBuilder();
        while (cursor < source.length() && source.charAt(cursor) != '}') {
            sb.append(source.charAt(cursor));
            cursor++;
        }
        if (cursor >= source.length()) {
            throw new RuleParseException("unterminated reference at " + startPos);
        }
        cursor++;
        return new RuleToken(type, sb.toString(), startPos);
    }

    private RuleToken d2Function(final int startPos) {
        cursor += 3;
        final StringBuilder sb = new StringBuilder();
        while (cursor < source.length() && (Character.isLetterOrDigit(source.charAt(cursor))
                || source.charAt(cursor) == '_')) {
            sb.append(source.charAt(cursor));
            cursor++;
        }
        if (sb.length() == 0) {
            throw new RuleParseException("expected d2 function name after 'd2:' at " + startPos);
        }
        return new RuleToken(RuleTokenType.D2_FUNCTION, sb.toString(), startPos);
    }

    private RuleToken identOrKeyword(final int startPos) {
        final StringBuilder sb = new StringBuilder();
        while (cursor < source.length()
                && (Character.isLetterOrDigit(source.charAt(cursor)) || source.charAt(cursor) == '_')) {
            sb.append(source.charAt(cursor));
            cursor++;
        }
        final String s = sb.toString();
        return switch (s) {
            case "true" -> new RuleToken(RuleTokenType.TRUE, s, startPos);
            case "false" -> new RuleToken(RuleTokenType.FALSE, s, startPos);
            case "null" -> new RuleToken(RuleTokenType.NULL, s, startPos);
            default -> new RuleToken(RuleTokenType.IDENT, s, startPos);
        };
    }

    private RuleToken operator(final char c, final int startPos) {
        cursor++;
        switch (c) {
            case '(':
                return new RuleToken(RuleTokenType.LPAREN, "(", startPos);
            case ')':
                return new RuleToken(RuleTokenType.RPAREN, ")", startPos);
            case ',':
                return new RuleToken(RuleTokenType.COMMA, ",", startPos);
            case '+':
                return new RuleToken(RuleTokenType.PLUS, "+", startPos);
            case '-':
                return new RuleToken(RuleTokenType.MINUS, "-", startPos);
            case '*':
                return new RuleToken(RuleTokenType.STAR, "*", startPos);
            case '/':
                return new RuleToken(RuleTokenType.SLASH, "/", startPos);
            case '.':
                return new RuleToken(RuleTokenType.DOT, ".", startPos);
            case '?':
                return new RuleToken(RuleTokenType.QUESTION, "?", startPos);
            case ':':
                return new RuleToken(RuleTokenType.COLON, ":", startPos);
            case '=':
                if (cursor < source.length() && source.charAt(cursor) == '=') {
                    cursor++;
                    return new RuleToken(RuleTokenType.EQ, "==", startPos);
                }
                return new RuleToken(RuleTokenType.EQ, "=", startPos);
            case '!':
                if (cursor < source.length() && source.charAt(cursor) == '=') {
                    cursor++;
                    return new RuleToken(RuleTokenType.NEQ, "!=", startPos);
                }
                return new RuleToken(RuleTokenType.NOT, "!", startPos);
            case '<':
                if (cursor < source.length() && source.charAt(cursor) == '=') {
                    cursor++;
                    return new RuleToken(RuleTokenType.LTE, "<=", startPos);
                }
                return new RuleToken(RuleTokenType.LT, "<", startPos);
            case '>':
                if (cursor < source.length() && source.charAt(cursor) == '=') {
                    cursor++;
                    return new RuleToken(RuleTokenType.GTE, ">=", startPos);
                }
                return new RuleToken(RuleTokenType.GT, ">", startPos);
            case '&':
                if (cursor < source.length() && source.charAt(cursor) == '&') {
                    cursor++;
                    return new RuleToken(RuleTokenType.AND, "&&", startPos);
                }
                throw new RuleParseException("unexpected '&' at " + startPos);
            case '|':
                if (cursor < source.length() && source.charAt(cursor) == '|') {
                    cursor++;
                    return new RuleToken(RuleTokenType.OR, "||", startPos);
                }
                throw new RuleParseException("unexpected '|' at " + startPos);
            default:
                throw new RuleParseException("unexpected character '" + c + "' at " + startPos);
        }
    }
}
