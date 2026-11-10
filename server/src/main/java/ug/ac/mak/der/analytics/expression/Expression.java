package ug.ac.mak.der.analytics.expression;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/**
 * Typed AST for DHIS2 program indicator / analytics expressions.
 *
 * <p>Spec §4.1 / §7 "expression lexer/parser/executor". This AST is
 * deliberately a small, closed sum type — new node kinds require
 * an explicit evaluator arm, so adding a feature means walking the
 * evaluator, type-checker and tests in lockstep (no silent
 * fall-through).</p>
 *
 * <p>Syntax conventions this AST models (not an exhaustive DHIS2
 * expression grammar):</p>
 * <ul>
 *   <li>{@code #{uid}} — event data element reference.</li>
 *   <li>{@code #{stageUid.deUid}} — stage-qualified event data
 *       element reference (enrollment-type indicators).</li>
 *   <li>{@code A{uid}} — tracked entity attribute reference.</li>
 *   <li>{@code V{var}} — variable (e.g. {@code V{event_date}}).</li>
 *   <li>{@code C{uid}} — constant reference.</li>
 *   <li>{@code d2:hasValue(ref)}, {@code d2:count(ref)}, …</li>
 *   <li>Binary + unary math + comparison + boolean operators.</li>
 *   <li>Parenthesised grouping, conditional {@code if(cond,a,b)}.</li>
 * </ul>
 */
public sealed interface Expression
        permits Expression.NumberLit,
                Expression.StringLit,
                Expression.BoolLit,
                Expression.NullLit,
                Expression.Reference,
                Expression.UnaryOp,
                Expression.BinaryOp,
                Expression.FunctionCall,
                Expression.If {

    /** Numeric literal. All numbers are big-decimal to preserve
     *  precision on sums of integer counts. */
    record NumberLit(BigDecimal value) implements Expression {
        public NumberLit {
            Objects.requireNonNull(value, "value");
        }
    }

    record StringLit(String value) implements Expression {
        public StringLit {
            Objects.requireNonNull(value, "value");
        }
    }

    record BoolLit(boolean value) implements Expression { }

    record NullLit() implements Expression { }

    /** {@code #{uid}}, {@code #{stage.de}}, {@code A{uid}},
     *  {@code V{var}}, {@code C{uid}}. */
    record Reference(Kind kind, String firstUid, String secondUid)
            implements Expression {
        public Reference {
            Objects.requireNonNull(kind, "kind");
            Objects.requireNonNull(firstUid, "firstUid");
        }

        /** Shorthand for single-segment references. */
        public static Reference single(final Kind kind, final String uid) {
            return new Reference(kind, uid, null);
        }

        public enum Kind {
            /** {@code #{uid}} or {@code #{stage.de}}. */
            DATA_ELEMENT,
            /** {@code A{uid}} — tracked entity attribute. */
            ATTRIBUTE,
            /** {@code V{var}} — pre-defined variable. */
            VARIABLE,
            /** {@code C{uid}} — constant metadata. */
            CONSTANT
        }
    }

    record UnaryOp(Operator op, Expression operand) implements Expression {
        public UnaryOp {
            Objects.requireNonNull(op, "op");
            Objects.requireNonNull(operand, "operand");
        }

        public enum Operator { NEG, NOT }
    }

    record BinaryOp(Operator op, Expression left, Expression right)
            implements Expression {
        public BinaryOp {
            Objects.requireNonNull(op, "op");
            Objects.requireNonNull(left, "left");
            Objects.requireNonNull(right, "right");
        }

        public enum Operator {
            ADD, SUB, MUL, DIV, MOD,
            EQ, NEQ, LT, LTE, GT, GTE,
            AND, OR
        }
    }

    record FunctionCall(String name, List<Expression> args)
            implements Expression {
        public FunctionCall {
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(args, "args");
            args = List.copyOf(args);
        }
    }

    record If(Expression condition, Expression thenBranch,
                Expression elseBranch) implements Expression {
        public If {
            Objects.requireNonNull(condition, "condition");
            Objects.requireNonNull(thenBranch, "thenBranch");
            Objects.requireNonNull(elseBranch, "elseBranch");
        }
    }
}
