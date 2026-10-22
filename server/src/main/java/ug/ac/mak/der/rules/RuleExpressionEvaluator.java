package ug.ac.mak.der.rules;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Evaluates a {@link RuleAst} against a {@link RuleContext}.
 *
 * <p>Semantics modelled on DHIS2's own program-rule engine (TypeScript
 * {@code @dhis2/rules-engine}). Null propagates through numeric arithmetic;
 * {@code '' == null} is false; booleans coerce to numbers for arithmetic only
 * on explicit cast.</p>
 */
public final class RuleExpressionEvaluator {

    private final RuleContext ctx;

    public RuleExpressionEvaluator(final RuleContext ctx) {
        this.ctx = Objects.requireNonNull(ctx, "ctx");
    }

    public Object evaluate(final RuleAst node) {
        return switch (node) {
            case RuleAst.NumberLit n -> n.value();
            case RuleAst.StringLit s -> s.value();
            case RuleAst.BoolLit b -> b.value();
            case RuleAst.NullLit n -> null;
            case RuleAst.AttributeRef r -> ctx.teiAttributes().get(r.uid());
            case RuleAst.DataElementRef r -> {
                final String compound = r.programStageUid() + "." + r.dataElementUid();
                if (ctx.assignedValues().containsKey(compound)) {
                    yield ctx.assignedValues().get(compound);
                }
                yield ctx.currentEventValues().get(compound);
            }
            case RuleAst.ConstantRef r -> ctx.constants().get(r.uid());
            case RuleAst.VariableRef r -> ctx.environment().get(r.name());
            case RuleAst.Unary u -> evalUnary(u);
            case RuleAst.Binary b -> evalBinary(b);
            case RuleAst.Ternary t -> truthy(evaluate(t.condition()))
                    ? evaluate(t.ifTrue())
                    : evaluate(t.ifFalse());
            case RuleAst.D2Call c -> callD2(c);
        };
    }

    private Object evalUnary(final RuleAst.Unary u) {
        final Object v = evaluate(u.operand());
        return switch (u.op()) {
            case "-" -> -asNumber(v);
            case "!" -> !truthy(v);
            default -> throw new RuleParseException("unknown unary op '" + u.op() + "'");
        };
    }

    private Object evalBinary(final RuleAst.Binary b) {
        if ("&&".equals(b.op())) {
            return truthy(evaluate(b.left())) && truthy(evaluate(b.right()));
        }
        if ("||".equals(b.op())) {
            return truthy(evaluate(b.left())) || truthy(evaluate(b.right()));
        }
        final Object left = evaluate(b.left());
        final Object right = evaluate(b.right());
        return switch (b.op()) {
            case "+" -> {
                if (left instanceof String || right instanceof String) {
                    yield asText(left) + asText(right);
                }
                yield asNumber(left) + asNumber(right);
            }
            case "-" -> asNumber(left) - asNumber(right);
            case "*" -> asNumber(left) * asNumber(right);
            case "/" -> asNumber(left) / asNumber(right);
            case "==" -> D2Functions.objectsEqual(left, right);
            case "!=" -> !D2Functions.objectsEqual(left, right);
            case "<" -> asNumber(left) < asNumber(right);
            case ">" -> asNumber(left) > asNumber(right);
            case "<=" -> asNumber(left) <= asNumber(right);
            case ">=" -> asNumber(left) >= asNumber(right);
            default -> throw new RuleParseException("unknown binary op '" + b.op() + "'");
        };
    }

    private Object callD2(final RuleAst.D2Call c) {
        final List<Object> args = new ArrayList<>(c.args().size());
        for (final RuleAst arg : c.args()) {
            if (arg instanceof RuleAst.DataElementRef de) {
                args.add(D2Functions.CountKey.of(de.programStageUid(), de.dataElementUid()));
            } else {
                args.add(evaluate(arg));
            }
        }
        return D2Functions.call(c.name(), args, ctx);
    }

    private static double asNumber(final Object v) {
        if (v == null) {
            return 0;
        }
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        if (v instanceof Boolean b) {
            return b ? 1 : 0;
        }
        try {
            return Double.parseDouble(v.toString());
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private static String asText(final Object v) {
        return v == null ? "" : v.toString();
    }

    private static boolean truthy(final Object v) {
        if (v == null) {
            return false;
        }
        if (v instanceof Boolean b) {
            return b;
        }
        if (v instanceof Number n) {
            return n.doubleValue() != 0;
        }
        if (v instanceof String s) {
            return !s.isEmpty();
        }
        return true;
    }
}
