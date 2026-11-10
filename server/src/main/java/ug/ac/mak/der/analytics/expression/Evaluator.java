package ug.ac.mak.der.analytics.expression;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Deterministic evaluator for parsed {@link Expression} trees.
 *
 * <p>Null semantics — any reference to a missing value propagates
 * {@code null} through numeric operators (so {@code #{foo} + 1}
 * where foo is absent → null, not {@code NaN}). Boolean operators
 * collapse null to {@code false} except for {@code d2:hasValue}
 * which explicitly inspects the presence bit.</p>
 *
 * <p>Supported functions (spec §4.1 "versioned support matrix"):</p>
 * <ul>
 *   <li>{@code d2:hasValue(ref)} — true when the reference resolves
 *       to a non-null value.</li>
 *   <li>{@code d2:count(ref)} — 1 when the reference has a value,
 *       0 otherwise. (Single-event grain; multi-event cohort
 *       counts land in Phase 4.)</li>
 *   <li>{@code d2:ceil(x) / d2:floor(x) / d2:round(x)} — rounding
 *       to the nearest integer; {@code d2:round} uses HALF_UP.</li>
 *   <li>{@code d2:zing(x)} — {@code max(x, 0)}.</li>
 *   <li>{@code d2:oizp(x)} — {@code 1} if {@code x > 0}, else
 *       {@code 0}. ("One If Positive".)</li>
 *   <li>{@code d2:daysBetween(a, b) / d2:yearsBetween(a, b)} —
 *       date arithmetic; both args must resolve to a parsable date.</li>
 * </ul>
 *
 * Any other function is rejected at evaluation time with a clean
 * {@link EvalException} (callers trap that and mark the metric
 * UNSUPPORTED — never return 0).
 */
public final class Evaluator {

    /** Functions this evaluator supports — exposed so the compiler
     *  can list them in diagnostics + the /capabilities response. */
    public static final Set<String> SUPPORTED_FUNCTIONS = Set.of(
            "d2:hasValue", "d2:count",
            "d2:ceil", "d2:floor", "d2:round",
            "d2:zing", "d2:oizp",
            "d2:daysBetween", "d2:yearsBetween");

    private static final MathContext MATH = MathContext.DECIMAL64;

    private final ExpressionContext ctx;

    public Evaluator(final ExpressionContext ctx) {
        this.ctx = Objects.requireNonNull(ctx, "ctx");
    }

    /** Evaluate an expression. Null means "no value" — same as DHIS2's
     *  program-indicator semantics when any referenced field is
     *  missing. */
    public Object eval(final Expression expr) {
        Objects.requireNonNull(expr, "expr");
        return switch (expr) {
            case Expression.NumberLit n -> n.value();
            case Expression.StringLit s -> s.value();
            case Expression.BoolLit b -> b.value();
            case Expression.NullLit ignored -> null;
            case Expression.Reference r -> evalRef(r);
            case Expression.UnaryOp u -> evalUnary(u);
            case Expression.BinaryOp b -> evalBinary(b);
            case Expression.FunctionCall f -> evalFunction(f);
            case Expression.If i -> evalIf(i);
        };
    }

    private Object evalRef(final Expression.Reference r) {
        // For data element refs: `#{DE1}` lands as (first=DE1, second=null)
        // meaning the whole body is the leaf UID; `#{STG1.DE1}` lands as
        // (first=STG1, second=DE1). Normalise so ctx sees (stage, de).
        final Optional<Object> opt = switch (r.kind()) {
            case DATA_ELEMENT -> {
                final String stage =
                        r.secondUid() == null ? null : r.firstUid();
                final String de = r.secondUid() == null
                        ? r.firstUid() : r.secondUid();
                yield ctx.dataElement(stage, de);
            }
            case ATTRIBUTE -> ctx.attribute(r.firstUid());
            case VARIABLE -> ctx.variable(r.firstUid());
            case CONSTANT -> ctx.constant(r.firstUid());
        };
        return opt.orElse(null);
    }

    private Object evalUnary(final Expression.UnaryOp u) {
        final Object v = eval(u.operand());
        return switch (u.op()) {
            case NEG -> {
                if (v == null) {
                    yield null;
                }
                yield toNumber(v).negate();
            }
            case NOT -> !toBool(v);
        };
    }

    private Object evalBinary(final Expression.BinaryOp b) {
        final Object left = eval(b.left());
        final Object right = eval(b.right());
        return switch (b.op()) {
            case ADD -> arithmetic(left, right, BigDecimal::add);
            case SUB -> arithmetic(left, right, BigDecimal::subtract);
            case MUL -> arithmetic(left, right, BigDecimal::multiply);
            case DIV -> {
                if (left == null || right == null) {
                    yield null;
                }
                final BigDecimal r = toNumber(right);
                if (r.signum() == 0) {
                    yield null;
                }
                yield toNumber(left).divide(r, MATH);
            }
            case MOD -> {
                if (left == null || right == null) {
                    yield null;
                }
                final BigDecimal r = toNumber(right);
                if (r.signum() == 0) {
                    yield null;
                }
                yield toNumber(left).remainder(r, MATH);
            }
            case EQ -> equals(left, right);
            case NEQ -> !equals(left, right);
            case LT -> compare(left, right, c -> c < 0);
            case LTE -> compare(left, right, c -> c <= 0);
            case GT -> compare(left, right, c -> c > 0);
            case GTE -> compare(left, right, c -> c >= 0);
            case AND -> toBool(left) && toBool(right);
            case OR -> toBool(left) || toBool(right);
        };
    }

    private Object evalIf(final Expression.If i) {
        final boolean cond = toBool(eval(i.condition()));
        return cond ? eval(i.thenBranch()) : eval(i.elseBranch());
    }

    private Object evalFunction(final Expression.FunctionCall f) {
        final String name = f.name();
        final List<Expression> args = f.args();
        return switch (name) {
            case "d2:hasValue" -> {
                expectArity(name, args, 1);
                yield eval(args.get(0)) != null;
            }
            case "d2:count" -> {
                expectArity(name, args, 1);
                yield eval(args.get(0)) != null
                        ? BigDecimal.ONE : BigDecimal.ZERO;
            }
            case "d2:ceil" -> {
                expectArity(name, args, 1);
                final Object v = eval(args.get(0));
                yield v == null ? null
                        : toNumber(v).setScale(0, RoundingMode.CEILING);
            }
            case "d2:floor" -> {
                expectArity(name, args, 1);
                final Object v = eval(args.get(0));
                yield v == null ? null
                        : toNumber(v).setScale(0, RoundingMode.FLOOR);
            }
            case "d2:round" -> {
                expectArity(name, args, 1);
                final Object v = eval(args.get(0));
                yield v == null ? null
                        : toNumber(v).setScale(0, RoundingMode.HALF_UP);
            }
            case "d2:zing" -> {
                expectArity(name, args, 1);
                final Object v = eval(args.get(0));
                if (v == null) {
                    yield BigDecimal.ZERO;
                }
                final BigDecimal n = toNumber(v);
                yield n.signum() < 0 ? BigDecimal.ZERO : n;
            }
            case "d2:oizp" -> {
                expectArity(name, args, 1);
                final Object v = eval(args.get(0));
                if (v == null) {
                    yield BigDecimal.ZERO;
                }
                yield toNumber(v).signum() > 0
                        ? BigDecimal.ONE : BigDecimal.ZERO;
            }
            case "d2:daysBetween" -> daysBetween(args);
            case "d2:yearsBetween" -> yearsBetween(args);
            default -> throw new EvalException(
                    "unsupported function '" + name + "'; supported: "
                  + SUPPORTED_FUNCTIONS);
        };
    }

    private Object daysBetween(final List<Expression> args) {
        expectArity("d2:daysBetween", args, 2);
        final LocalDate a = ExpressionContext.asDate(eval(args.get(0)));
        final LocalDate b = ExpressionContext.asDate(eval(args.get(1)));
        if (a == null || b == null) {
            return null;
        }
        return BigDecimal.valueOf(ChronoUnit.DAYS.between(a, b));
    }

    private Object yearsBetween(final List<Expression> args) {
        expectArity("d2:yearsBetween", args, 2);
        final LocalDate a = ExpressionContext.asDate(eval(args.get(0)));
        final LocalDate b = ExpressionContext.asDate(eval(args.get(1)));
        if (a == null || b == null) {
            return null;
        }
        return BigDecimal.valueOf(ChronoUnit.YEARS.between(a, b));
    }

    private static void expectArity(final String fn,
                                      final List<Expression> args,
                                      final int n) {
        if (args.size() != n) {
            throw new EvalException(
                    fn + "() expects " + n + " argument(s); got "
                            + args.size());
        }
    }

    /* ─────── coercion helpers ─────── */

    private static Object arithmetic(final Object left, final Object right,
                                       final java.util.function.BinaryOperator<BigDecimal> op) {
        if (left == null || right == null) {
            return null;
        }
        return op.apply(toNumber(left), toNumber(right));
    }

    private static boolean compare(final Object left, final Object right,
                                     final java.util.function.IntPredicate pred) {
        if (left == null || right == null) {
            return false;
        }
        return pred.test(toNumber(left).compareTo(toNumber(right)));
    }

    private static boolean equals(final Object left, final Object right) {
        if (left == null || right == null) {
            return left == right;
        }
        if (left instanceof BigDecimal || right instanceof BigDecimal) {
            return toNumber(left).compareTo(toNumber(right)) == 0;
        }
        return left.equals(right);
    }

    private static BigDecimal toNumber(final Object v) {
        if (v instanceof BigDecimal b) {
            return b;
        }
        if (v instanceof Number n) {
            return new BigDecimal(n.toString());
        }
        if (v instanceof Boolean bo) {
            return bo ? BigDecimal.ONE : BigDecimal.ZERO;
        }
        if (v instanceof CharSequence s) {
            try {
                return new BigDecimal(s.toString());
            } catch (NumberFormatException ex) {
                throw new EvalException(
                        "cannot coerce '" + s + "' to number");
            }
        }
        throw new EvalException(
                "cannot coerce " + v.getClass().getSimpleName()
                        + " to number");
    }

    private static boolean toBool(final Object v) {
        if (v == null) {
            return false;
        }
        if (v instanceof Boolean b) {
            return b;
        }
        if (v instanceof BigDecimal bd) {
            return bd.signum() != 0;
        }
        if (v instanceof Number n) {
            return n.doubleValue() != 0.0;
        }
        if (v instanceof CharSequence s) {
            final String str = s.toString().trim().toLowerCase();
            return "true".equals(str) || "1".equals(str);
        }
        return true;
    }

    public static final class EvalException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public EvalException(final String message) {
            super(message);
        }
    }
}
