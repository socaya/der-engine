package ug.ac.mak.der.analytics.expression;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Recursive-descent parser producing an {@link Expression} AST
 * from a token stream.
 *
 * <p>Precedence (lowest → highest):</p>
 * <ol>
 *   <li>{@code ||}</li>
 *   <li>{@code &&}</li>
 *   <li>{@code == !=}</li>
 *   <li>{@code < <= > >=}</li>
 *   <li>{@code + -} (binary)</li>
 *   <li>{@code * / %}</li>
 *   <li>unary {@code - !}</li>
 *   <li>primary (literal / reference / function-call / paren)</li>
 * </ol>
 */
public final class Parser {

    private final List<Token> tokens;
    private int pos;

    public Parser(final List<Token> tokens) {
        this.tokens = tokens;
    }

    public static Expression parse(final String source) {
        return new Parser(Lexer.tokenise(source)).parseExpression();
    }

    public Expression parseExpression() {
        final Expression e = or();
        expect(Token.Kind.EOF);
        return e;
    }

    private Expression or() {
        Expression left = and();
        while (match(Token.Kind.OR)) {
            final Expression right = and();
            left = new Expression.BinaryOp(
                    Expression.BinaryOp.Operator.OR, left, right);
        }
        return left;
    }

    private Expression and() {
        Expression left = equality();
        while (match(Token.Kind.AND)) {
            final Expression right = equality();
            left = new Expression.BinaryOp(
                    Expression.BinaryOp.Operator.AND, left, right);
        }
        return left;
    }

    private Expression equality() {
        Expression left = comparison();
        while (true) {
            if (match(Token.Kind.EQ)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.EQ, left, comparison());
            } else if (match(Token.Kind.NEQ)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.NEQ, left, comparison());
            } else {
                return left;
            }
        }
    }

    private Expression comparison() {
        Expression left = additive();
        while (true) {
            if (match(Token.Kind.LT)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.LT, left, additive());
            } else if (match(Token.Kind.LTE)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.LTE, left, additive());
            } else if (match(Token.Kind.GT)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.GT, left, additive());
            } else if (match(Token.Kind.GTE)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.GTE, left, additive());
            } else {
                return left;
            }
        }
    }

    private Expression additive() {
        Expression left = multiplicative();
        while (true) {
            if (match(Token.Kind.PLUS)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.ADD, left,
                        multiplicative());
            } else if (match(Token.Kind.MINUS)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.SUB, left,
                        multiplicative());
            } else {
                return left;
            }
        }
    }

    private Expression multiplicative() {
        Expression left = unary();
        while (true) {
            if (match(Token.Kind.STAR)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.MUL, left, unary());
            } else if (match(Token.Kind.SLASH)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.DIV, left, unary());
            } else if (match(Token.Kind.PERCENT)) {
                left = new Expression.BinaryOp(
                        Expression.BinaryOp.Operator.MOD, left, unary());
            } else {
                return left;
            }
        }
    }

    private Expression unary() {
        if (match(Token.Kind.MINUS)) {
            return new Expression.UnaryOp(
                    Expression.UnaryOp.Operator.NEG, unary());
        }
        if (match(Token.Kind.NOT)) {
            return new Expression.UnaryOp(
                    Expression.UnaryOp.Operator.NOT, unary());
        }
        return primary();
    }

    private Expression primary() {
        if (pos >= tokens.size()) {
            throw new ParseException(
                    "unexpected end of expression");
        }
        final Token t = tokens.get(pos);
        switch (t.kind()) {
            case NUMBER:
                pos++;
                return new Expression.NumberLit(new BigDecimal(t.text()));
            case STRING:
                pos++;
                return new Expression.StringLit(t.text());
            case BOOL_TRUE:
                pos++;
                return new Expression.BoolLit(true);
            case BOOL_FALSE:
                pos++;
                return new Expression.BoolLit(false);
            case NULL:
                pos++;
                return new Expression.NullLit();
            case REF_DATA_ELEMENT:
                pos++;
                return parseReference(Expression.Reference.Kind.DATA_ELEMENT,
                        t.text());
            case REF_ATTRIBUTE:
                pos++;
                return parseReference(Expression.Reference.Kind.ATTRIBUTE,
                        t.text());
            case REF_VARIABLE:
                pos++;
                return parseReference(Expression.Reference.Kind.VARIABLE,
                        t.text());
            case REF_CONSTANT:
                pos++;
                return parseReference(Expression.Reference.Kind.CONSTANT,
                        t.text());
            case IDENT:
                return identOrCall();
            case LPAREN:
                pos++;
                final Expression inner = or();
                expect(Token.Kind.RPAREN);
                return inner;
            default:
                throw new ParseException(
                        "unexpected token '" + t.text() + "' at "
                                + t.start());
        }
    }

    private Expression parseReference(
            final Expression.Reference.Kind kind,
            final String body) {
        final int dot = body.indexOf('.');
        if (dot >= 0) {
            return new Expression.Reference(kind,
                    body.substring(0, dot).trim(),
                    body.substring(dot + 1).trim());
        }
        return new Expression.Reference(kind, body, null);
    }

    private Expression identOrCall() {
        final Token id = tokens.get(pos);
        if (pos + 1 < tokens.size()
                && tokens.get(pos + 1).kind() == Token.Kind.LPAREN) {
            pos += 2; // consume ident + '('
            final List<Expression> args = new ArrayList<>();
            if (!check(Token.Kind.RPAREN)) {
                args.add(or());
                while (match(Token.Kind.COMMA)) {
                    args.add(or());
                }
            }
            expect(Token.Kind.RPAREN);
            if ("if".equalsIgnoreCase(id.text())) {
                if (args.size() != 3) {
                    throw new ParseException(
                            "if() expects 3 arguments; got " + args.size());
                }
                return new Expression.If(args.get(0), args.get(1),
                        args.get(2));
            }
            return new Expression.FunctionCall(id.text(), args);
        }
        throw new ParseException(
                "bare identifier '" + id.text() + "' is not supported "
              + "at " + id.start() + "; references must be #{…}, A{…}, "
              + "V{…} or C{…}");
    }

    /* ─────── helpers ─────── */

    private boolean match(final Token.Kind kind) {
        if (check(kind)) {
            pos++;
            return true;
        }
        return false;
    }

    private boolean check(final Token.Kind kind) {
        return pos < tokens.size() && tokens.get(pos).kind() == kind;
    }

    private void expect(final Token.Kind kind) {
        if (!check(kind)) {
            final Token t = pos < tokens.size()
                    ? tokens.get(pos)
                    : new Token(Token.Kind.EOF, "<eof>", -1);
            throw new ParseException(
                    "expected " + kind + " but got " + t.kind()
                  + " ('" + t.text() + "') at " + t.start());
        }
        pos++;
    }

    public static final class ParseException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public ParseException(final String message) {
            super(message);
        }
    }
}
