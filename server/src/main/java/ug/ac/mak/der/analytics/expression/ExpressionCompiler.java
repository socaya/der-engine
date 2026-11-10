package ug.ac.mak.der.analytics.expression;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;

/**
 * Compiles a DHIS2 program indicator expression string into a
 * typed AST and classifies its support state.
 *
 * <p>Spec §4.1 — this is the enforcement point for AN-FR-003 to
 * AN-FR-005: a definition either compiles into the typed AST or is
 * explicitly marked {@code UNSUPPORTED} with an actionable
 * diagnostic. No silent zero-return paths.</p>
 */
@Service
public class ExpressionCompiler {

    public enum SupportState {
        /** Compiled, type-checked, functions all supported. */
        READY,
        /** Compiled but contains functions we don't execute yet.
         *  The AST is still emitted so operators can inspect. */
        UNSUPPORTED,
        /** Failed to parse. No AST. */
        PARSE_ERROR
    }

    public record CompileResult(
            Expression ast,
            SupportState supportState,
            List<String> diagnostics,
            Set<String> referencedDataElements,
            Set<String> referencedAttributes,
            Set<String> referencedVariables,
            Set<String> referencedConstants,
            Set<String> referencedFunctions) {

        public boolean parsed() {
            return ast != null;
        }

        public boolean ready() {
            return supportState == SupportState.READY;
        }
    }

    public CompileResult compile(final String source) {
        if (source == null || source.trim().isEmpty()) {
            return new CompileResult(null, SupportState.PARSE_ERROR,
                    List.of("expression is empty"),
                    Set.of(), Set.of(), Set.of(), Set.of(), Set.of());
        }
        Expression ast;
        try {
            ast = Parser.parse(source);
        } catch (Lexer.LexException | Parser.ParseException ex) {
            return new CompileResult(null, SupportState.PARSE_ERROR,
                    List.of(ex.getMessage()),
                    Set.of(), Set.of(), Set.of(), Set.of(), Set.of());
        }
        final Set<String> des = new LinkedHashSet<>();
        final Set<String> attrs = new LinkedHashSet<>();
        final Set<String> vars = new LinkedHashSet<>();
        final Set<String> consts = new LinkedHashSet<>();
        final Set<String> funcs = new LinkedHashSet<>();
        final List<String> diagnostics = new ArrayList<>();
        walk(ast, des, attrs, vars, consts, funcs);
        final SupportState state = classify(funcs, diagnostics);
        return new CompileResult(ast, state, List.copyOf(diagnostics),
                Set.copyOf(des), Set.copyOf(attrs), Set.copyOf(vars),
                Set.copyOf(consts), Set.copyOf(funcs));
    }

    private static void walk(final Expression e,
                               final Set<String> des,
                               final Set<String> attrs,
                               final Set<String> vars,
                               final Set<String> consts,
                               final Set<String> funcs) {
        switch (e) {
            case Expression.NumberLit ignored -> { }
            case Expression.StringLit ignored -> { }
            case Expression.BoolLit ignored -> { }
            case Expression.NullLit ignored -> { }
            case Expression.Reference r -> {
                final String key = r.secondUid() == null
                        ? r.firstUid()
                        : r.firstUid() + "." + r.secondUid();
                switch (r.kind()) {
                    case DATA_ELEMENT -> des.add(key);
                    case ATTRIBUTE -> attrs.add(key);
                    case VARIABLE -> vars.add(key);
                    case CONSTANT -> consts.add(key);
                    default -> { }
                }
            }
            case Expression.UnaryOp u -> walk(u.operand(), des, attrs, vars, consts, funcs);
            case Expression.BinaryOp b -> {
                walk(b.left(), des, attrs, vars, consts, funcs);
                walk(b.right(), des, attrs, vars, consts, funcs);
            }
            case Expression.FunctionCall f -> {
                funcs.add(f.name());
                for (final Expression a : f.args()) {
                    walk(a, des, attrs, vars, consts, funcs);
                }
            }
            case Expression.If i -> {
                walk(i.condition(), des, attrs, vars, consts, funcs);
                walk(i.thenBranch(), des, attrs, vars, consts, funcs);
                walk(i.elseBranch(), des, attrs, vars, consts, funcs);
            }
        }
    }

    private static SupportState classify(final Set<String> funcs,
                                           final List<String> diagnostics) {
        boolean unsupportedSeen = false;
        for (final String f : funcs) {
            if (!Evaluator.SUPPORTED_FUNCTIONS.contains(f)) {
                diagnostics.add("unsupported function '" + f + "'");
                unsupportedSeen = true;
            }
        }
        return unsupportedSeen ? SupportState.UNSUPPORTED
                : SupportState.READY;
    }

    /** Convenience — compile then (if READY) evaluate against the
     *  supplied context. Returns the evaluated value or null if the
     *  compile produced no AST or the state isn't READY. */
    public Object compileAndEvaluate(final String source,
                                       final ExpressionContext ctx) {
        Objects.requireNonNull(ctx, "ctx");
        final CompileResult r = compile(source);
        if (!r.ready()) {
            return null;
        }
        try {
            return new Evaluator(ctx).eval(r.ast());
        } catch (Evaluator.EvalException ex) {
            return null;
        }
    }
}
