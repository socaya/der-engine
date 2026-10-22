package ug.ac.mak.der.rules;

import java.util.ArrayList;
import java.util.List;

import ug.ac.mak.der.rules.RuleToken.RuleTokenType;

/**
 * Hand-written recursive-descent parser for DHIS2 program-rule expressions.
 *
 * <p>Grammar precedence (low to high):</p>
 * <pre>
 *   ternary := or ('?' or ':' or)?
 *   or      := and ('||' and)*
 *   and     := equality ('&&' equality)*
 *   equality:= comparison (('==' | '!=') comparison)*
 *   compare := additive (('<' | '<=' | '>' | '>=') additive)*
 *   additive:= multiplicative (('+' | '-') multiplicative)*
 *   mult    := unary (('*' | '/') unary)*
 *   unary   := ('!' | '-') unary | primary
 *   primary := literal | reference | d2Call | '(' ternary ')'
 * </pre>
 */
public final class RuleParser {

    private final List<RuleToken> tokens;
    private int cursor;

    public RuleParser(final String source) {
        this.tokens = new RuleLexer(source).tokenise();
        this.cursor = 0;
    }

    public RuleAst parse() {
        final RuleAst expr = ternary();
        if (peek().type() != RuleTokenType.EOF) {
            throw new RuleParseException("trailing input at " + peek().position()
                    + ": '" + peek().text() + "'");
        }
        return expr;
    }

    private RuleAst ternary() {
        final RuleAst cond = or();
        if (match(RuleTokenType.QUESTION)) {
            final RuleAst a = or();
            expect(RuleTokenType.COLON);
            final RuleAst b = or();
            return new RuleAst.Ternary(cond, a, b);
        }
        return cond;
    }

    private RuleAst or() {
        RuleAst left = and();
        while (match(RuleTokenType.OR)) {
            left = new RuleAst.Binary("||", left, and());
        }
        return left;
    }

    private RuleAst and() {
        RuleAst left = equality();
        while (match(RuleTokenType.AND)) {
            left = new RuleAst.Binary("&&", left, equality());
        }
        return left;
    }

    private RuleAst equality() {
        RuleAst left = compare();
        while (peek().type() == RuleTokenType.EQ || peek().type() == RuleTokenType.NEQ) {
            final String op = advance().text();
            left = new RuleAst.Binary(op.equals("=") ? "==" : op, left, compare());
        }
        return left;
    }

    private RuleAst compare() {
        RuleAst left = additive();
        while (peek().type() == RuleTokenType.LT || peek().type() == RuleTokenType.GT
                || peek().type() == RuleTokenType.LTE || peek().type() == RuleTokenType.GTE) {
            final String op = advance().text();
            left = new RuleAst.Binary(op, left, additive());
        }
        return left;
    }

    private RuleAst additive() {
        RuleAst left = multiplicative();
        while (peek().type() == RuleTokenType.PLUS || peek().type() == RuleTokenType.MINUS) {
            final String op = advance().text();
            left = new RuleAst.Binary(op, left, multiplicative());
        }
        return left;
    }

    private RuleAst multiplicative() {
        RuleAst left = unary();
        while (peek().type() == RuleTokenType.STAR || peek().type() == RuleTokenType.SLASH) {
            final String op = advance().text();
            left = new RuleAst.Binary(op, left, unary());
        }
        return left;
    }

    private RuleAst unary() {
        if (peek().type() == RuleTokenType.NOT || peek().type() == RuleTokenType.MINUS) {
            final String op = advance().text();
            return new RuleAst.Unary(op, unary());
        }
        return primary();
    }

    private RuleAst primary() {
        final RuleToken t = advance();
        return switch (t.type()) {
            case NUMBER -> new RuleAst.NumberLit(Double.parseDouble(t.text()));
            case STRING -> new RuleAst.StringLit(t.text());
            case TRUE -> new RuleAst.BoolLit(true);
            case FALSE -> new RuleAst.BoolLit(false);
            case NULL -> new RuleAst.NullLit();
            case REF_ATTRIBUTE -> new RuleAst.AttributeRef(t.text());
            case REF_DATA_ELEMENT -> parseDataElementRef(t.text());
            case REF_CONSTANT -> new RuleAst.ConstantRef(t.text());
            case REF_VARIABLE -> new RuleAst.VariableRef(t.text());
            case D2_FUNCTION -> parseD2Call(t.text());
            case LPAREN -> parseParenthesised();
            default -> throw new RuleParseException("unexpected token '" + t.text()
                    + "' at " + t.position());
        };
    }

    private RuleAst parseParenthesised() {
        final RuleAst inner = ternary();
        expect(RuleTokenType.RPAREN);
        return inner;
    }

    private RuleAst parseDataElementRef(final String text) {
        final int dot = text.indexOf('.');
        if (dot < 0) {
            throw new RuleParseException(
                    "data-element reference '#{" + text + "}' must be of the form 'psUid.deUid'");
        }
        return new RuleAst.DataElementRef(text.substring(0, dot), text.substring(dot + 1));
    }

    private RuleAst parseD2Call(final String name) {
        expect(RuleTokenType.LPAREN);
        final List<RuleAst> args = new ArrayList<>();
        if (peek().type() != RuleTokenType.RPAREN) {
            args.add(ternary());
            while (match(RuleTokenType.COMMA)) {
                args.add(ternary());
            }
        }
        expect(RuleTokenType.RPAREN);
        return new RuleAst.D2Call(name, args);
    }

    private RuleToken peek() {
        return tokens.get(cursor);
    }

    private RuleToken advance() {
        final RuleToken t = tokens.get(cursor);
        if (t.type() != RuleTokenType.EOF) {
            cursor++;
        }
        return t;
    }

    private boolean match(final RuleTokenType type) {
        if (peek().type() == type) {
            advance();
            return true;
        }
        return false;
    }

    private void expect(final RuleTokenType type) {
        if (peek().type() != type) {
            throw new RuleParseException("expected " + type + " but got '" + peek().text()
                    + "' at " + peek().position());
        }
        advance();
    }
}
