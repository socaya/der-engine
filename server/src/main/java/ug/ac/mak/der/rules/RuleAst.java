package ug.ac.mak.der.rules;

import java.util.List;

/**
 * AST nodes for a parsed DHIS2 program-rule expression. Sealed hierarchy so
 * {@link RuleExpressionEvaluator} exhausts the cases.
 */
public sealed interface RuleAst permits
        RuleAst.NumberLit,
        RuleAst.StringLit,
        RuleAst.BoolLit,
        RuleAst.NullLit,
        RuleAst.AttributeRef,
        RuleAst.DataElementRef,
        RuleAst.ConstantRef,
        RuleAst.VariableRef,
        RuleAst.Unary,
        RuleAst.Binary,
        RuleAst.Ternary,
        RuleAst.D2Call {

    record NumberLit(double value) implements RuleAst { }

    record StringLit(String value) implements RuleAst { }

    record BoolLit(boolean value) implements RuleAst { }

    record NullLit() implements RuleAst { }

    record AttributeRef(String uid) implements RuleAst { }

    record DataElementRef(String programStageUid, String dataElementUid) implements RuleAst { }

    record ConstantRef(String uid) implements RuleAst { }

    record VariableRef(String name) implements RuleAst { }

    record Unary(String op, RuleAst operand) implements RuleAst { }

    record Binary(String op, RuleAst left, RuleAst right) implements RuleAst { }

    record Ternary(RuleAst condition, RuleAst ifTrue, RuleAst ifFalse) implements RuleAst { }

    record D2Call(String name, List<RuleAst> args) implements RuleAst { }
}
