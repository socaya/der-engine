package org.der.android.core.rules

import java.time.LocalDate
import java.time.Period
import java.time.format.DateTimeParseException
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.round

/**
 * Minimal DHIS2 program-rule expression evaluator. Covers the
 * subset of the DHIS2 rule-engine spec that actually fires in pilot
 * programmes:
 *   - References: `#{var}` (named variable), `A{UID}` (data
 *     element in the current event), `V{env}` (built-ins)
 *   - Literals: `"string"`, `'string'`, numbers, `true`, `false`
 *   - Operators: `!`, unary `-`, `*`, `/`, `+`, `-`, `<`, `<=`,
 *     `>`, `>=`, `==`, `!=`, `&&`, `||`
 *   - Functions: the 15 most-used `d2:…` helpers
 *
 * The evaluator is forgiving — a missing variable surfaces as an
 * empty string / null numeric rather than throwing. That matches
 * DHIS2's own rule-engine semantics.
 */
class ExpressionEvaluator(
    private val variables: Map<String, Any?>,
    private val env: Map<String, Any?> = emptyMap(),
) {

    fun evaluate(expression: String): Any? = runCatching {
        Parser(Tokenizer(expression).tokens(), this).parse()
    }.getOrElse { null }

    fun evaluateBoolean(expression: String): Boolean = when (val v = evaluate(expression)) {
        is Boolean -> v
        is Number -> v.toDouble() != 0.0
        is String -> v.equals("true", ignoreCase = true) || v == "1"
        null -> false
        else -> false
    }

    fun evaluateString(expression: String): String? = when (val v = evaluate(expression)) {
        null -> null
        is Number -> {
            val d = v.toDouble()
            if (d == d.toLong().toDouble()) d.toLong().toString() else d.toString()
        }
        else -> v.toString()
    }

    internal fun resolveVariable(name: String): Any? = variables[name]
    internal fun resolveEnv(name: String): Any? = env[name]
}

// ── token model ─────────────────────────────────────────────────────

internal sealed interface Token {
    data class Num(val v: Double) : Token
    data class Str(val v: String) : Token
    data class Bool(val v: Boolean) : Token
    data object Null : Token
    data class Ident(val name: String) : Token
    data class Var(val name: String) : Token        // #{...}
    data class Attr(val uid: String) : Token        // A{...} / #{...} when surrounded by A{}
    data class EnvVar(val name: String) : Token     // V{...}
    data object LParen : Token
    data object RParen : Token
    data object Comma : Token
    data object Colon : Token
    data class Op(val sym: String) : Token
    data object End : Token
}

// ── tokenizer ───────────────────────────────────────────────────────

internal class Tokenizer(private val src: String) {

    private var i = 0

    fun tokens(): List<Token> {
        val out = mutableListOf<Token>()
        while (i < src.length) {
            val c = src[i]
            when {
                c.isWhitespace() -> i++
                c.isDigit() || (c == '.' && i + 1 < src.length && src[i + 1].isDigit()) ->
                    out += readNumber()
                c == '"' || c == '\'' -> out += readString(c)
                c == '#' -> out += readBracket('#') { Token.Var(it) }
                c == 'A' && peek(1) == '{' -> out += readBracket('A') { Token.Attr(it) }
                c == 'V' && peek(1) == '{' -> out += readBracket('V') { Token.EnvVar(it) }
                c == '(' -> { out += Token.LParen; i++ }
                c == ')' -> { out += Token.RParen; i++ }
                c == ',' -> { out += Token.Comma; i++ }
                c == ':' -> { out += Token.Colon; i++ }
                c in "+-*/<>=!&|" -> out += readOp()
                c.isLetter() || c == '_' -> out += readIdent()
                else -> i++  // skip garbage silently
            }
        }
        out += Token.End
        return out
    }

    private fun peek(offset: Int): Char? =
        if (i + offset < src.length) src[i + offset] else null

    private fun readNumber(): Token {
        val start = i
        while (i < src.length && (src[i].isDigit() || src[i] == '.')) i++
        return Token.Num(src.substring(start, i).toDoubleOrNull() ?: 0.0)
    }

    private fun readString(quote: Char): Token {
        i++  // skip opening quote
        val start = i
        while (i < src.length && src[i] != quote) i++
        val v = src.substring(start, i)
        if (i < src.length) i++
        return Token.Str(v)
    }

    private fun readBracket(prefix: Char, make: (String) -> Token): Token {
        i++  // the prefix letter
        if (i < src.length && src[i] == '{') i++
        val start = i
        while (i < src.length && src[i] != '}') i++
        val name = src.substring(start, i)
        if (i < src.length) i++  // closing '}'
        // '#{...}' in DHIS2 is a named ref; others map to their maker.
        return if (prefix == '#') Token.Var(name) else make(name)
    }

    private fun readOp(): Token {
        val two = src.substring(i, minOf(i + 2, src.length))
        return if (two in listOf("==", "!=", "<=", ">=", "&&", "||")) {
            i += 2; Token.Op(two)
        } else {
            val one = src[i].toString(); i++; Token.Op(one)
        }
    }

    private fun readIdent(): Token {
        val start = i
        while (i < src.length && (src[i].isLetterOrDigit() || src[i] == '_' || src[i] == '.')) i++
        val name = src.substring(start, i)
        return when (name.lowercase()) {
            "true" -> Token.Bool(true)
            "false" -> Token.Bool(false)
            "null" -> Token.Null
            else -> Token.Ident(name)
        }
    }
}

// ── parser (recursive descent) ──────────────────────────────────────

internal class Parser(
    private val tokens: List<Token>,
    private val ev: ExpressionEvaluator,
) {
    private var pos = 0

    fun parse(): Any? {
        val v = parseOr()
        return v
    }

    private fun peek(): Token = tokens[pos]
    private fun consume(): Token = tokens[pos++]
    private fun matchOp(sym: String): Boolean {
        val t = peek()
        if (t is Token.Op && t.sym == sym) { pos++; return true }
        return false
    }

    private fun parseOr(): Any? {
        var left = parseAnd()
        while (matchOp("||")) {
            val right = parseAnd()
            left = asBool(left) || asBool(right)
        }
        return left
    }

    private fun parseAnd(): Any? {
        var left = parseEquality()
        while (matchOp("&&")) {
            val right = parseEquality()
            left = asBool(left) && asBool(right)
        }
        return left
    }

    private fun parseEquality(): Any? {
        var left = parseCompare()
        while (true) {
            val t = peek()
            if (t is Token.Op && t.sym == "==") {
                pos++; left = eq(left, parseCompare())
            } else if (t is Token.Op && t.sym == "!=") {
                pos++; left = !eq(left, parseCompare())
            } else break
        }
        return left
    }

    private fun parseCompare(): Any? {
        var left = parseAdd()
        while (true) {
            val t = peek()
            if (t is Token.Op && t.sym in listOf("<", "<=", ">", ">=")) {
                pos++
                val right = parseAdd()
                val a = asDouble(left) ?: return false
                val b = asDouble(right) ?: return false
                left = when (t.sym) {
                    "<" -> a < b; "<=" -> a <= b
                    ">" -> a > b; ">=" -> a >= b
                    else -> false
                }
            } else break
        }
        return left
    }

    private fun parseAdd(): Any? {
        var left = parseMul()
        while (true) {
            val t = peek()
            if (t is Token.Op && (t.sym == "+" || t.sym == "-")) {
                pos++
                val right = parseMul()
                val leftVal = left
                val rightVal = right
                val a = asDouble(leftVal)
                val b = asDouble(rightVal)
                left = when {
                    a != null && b != null ->
                        if (t.sym == "+") a + b else a - b
                    // Null arithmetic propagates null (DHIS2
                    // semantic). Only '+' concats when both sides
                    // are explicitly strings the operator typed.
                    t.sym == "+" && leftVal is String && rightVal is String ->
                        leftVal + rightVal
                    else -> null
                }
            } else break
        }
        return left
    }

    private fun parseMul(): Any? {
        var left = parseUnary()
        while (true) {
            val t = peek()
            if (t is Token.Op && (t.sym == "*" || t.sym == "/")) {
                pos++
                val right = parseUnary()
                val a = asDouble(left) ?: return null
                val b = asDouble(right) ?: return null
                left = when (t.sym) {
                    "*" -> a * b
                    "/" -> if (b == 0.0) null else a / b
                    else -> null
                }
            } else break
        }
        return left
    }

    private fun parseUnary(): Any? {
        val t = peek()
        if (t is Token.Op && t.sym == "!") { pos++; return !asBool(parseUnary()) }
        if (t is Token.Op && t.sym == "-") { pos++; return -(asDouble(parseUnary()) ?: 0.0) }
        return parsePrimary()
    }

    private fun parsePrimary(): Any? {
        return when (val t = consume()) {
            is Token.Num -> t.v
            is Token.Str -> t.v
            is Token.Bool -> t.v
            Token.Null -> null
            is Token.Var -> ev.resolveVariable(t.name)
            is Token.Attr -> ev.resolveVariable(t.uid)  // A{UID} = variable keyed by UID
            is Token.EnvVar -> ev.resolveEnv(t.name)
            Token.LParen -> {
                val v = parseOr()
                if (peek() is Token.RParen) pos++
                v
            }
            is Token.Ident -> maybeCall(t.name)
            else -> null
        }
    }

    private fun maybeCall(name: String): Any? {
        // d2:foo( args ) — DHIS2 rule-engine namespaced function.
        val head: String = if (peek() is Token.Colon && name.lowercase() == "d2") {
            pos++
            val next = consume()
            if (next !is Token.Ident) return null
            "d2:${next.name}"
        } else {
            name
        }
        if (peek() !is Token.LParen) return null
        pos++  // consume '('
        val args = mutableListOf<Any?>()
        if (peek() !is Token.RParen) {
            args += parseOr()
            while (peek() is Token.Comma) { pos++; args += parseOr() }
        }
        if (peek() is Token.RParen) pos++
        return D2Functions.call(head, args)
    }

    private fun eq(a: Any?, b: Any?): Boolean {
        val da = asDouble(a); val db = asDouble(b)
        if (da != null && db != null) return da == db
        return (a?.toString() ?: "") == (b?.toString() ?: "")
    }

    private fun asBool(v: Any?): Boolean = when (v) {
        is Boolean -> v
        is Number -> v.toDouble() != 0.0
        is String -> v.isNotEmpty() && !v.equals("false", ignoreCase = true) && v != "0"
        null -> false
        else -> true
    }

    private fun asDouble(v: Any?): Double? = when (v) {
        is Number -> v.toDouble()
        is String -> v.toDoubleOrNull()
        is Boolean -> if (v) 1.0 else 0.0
        else -> null
    }
}

// ── d2:* functions ──────────────────────────────────────────────────

internal object D2Functions {
    fun call(name: String, args: List<Any?>): Any? = when (name) {
        "d2:hasValue" -> args.firstOrNull()?.let { v ->
            when (v) {
                is String -> v.isNotBlank()
                null -> false
                else -> true
            }
        } ?: false

        "d2:count" -> when (val v = args.firstOrNull()) {
            null -> 0
            is List<*> -> v.size
            is String -> if (v.isBlank()) 0 else 1
            else -> 1
        }

        "d2:length" -> (args.firstOrNull()?.toString() ?: "").length

        "d2:concatenate" -> args.joinToString("") { it?.toString() ?: "" }

        "d2:ceil" -> ceil(asDouble(args.firstOrNull()) ?: 0.0)
        "d2:floor" -> floor(asDouble(args.firstOrNull()) ?: 0.0)
        "d2:round" -> {
            // DHIS2's rule engine rounds half-up (not banker's).
            val v = asDouble(args.firstOrNull()) ?: 0.0
            floor(v + 0.5)
        }

        "d2:zing" -> {
            val v = asDouble(args.firstOrNull()) ?: 0.0
            if (v < 0.0) 0.0 else v
        }
        "d2:oizp" -> {
            val v = asDouble(args.firstOrNull()) ?: 0.0
            if (v >= 0.0) 1.0 else 0.0
        }

        "d2:daysBetween" -> daysBetween(args.getOrNull(0), args.getOrNull(1))
        "d2:weeksBetween" -> daysBetween(args.getOrNull(0), args.getOrNull(1))?.div(7)
        "d2:monthsBetween" -> monthsBetween(args.getOrNull(0), args.getOrNull(1))
        "d2:yearsBetween" -> yearsBetween(args.getOrNull(0), args.getOrNull(1))

        "d2:addDays" -> addDays(args.getOrNull(0), args.getOrNull(1))

        "d2:substring" -> {
            val s = args.getOrNull(0)?.toString() ?: ""
            val start = asDouble(args.getOrNull(1))?.toInt() ?: 0
            val end = asDouble(args.getOrNull(2))?.toInt() ?: s.length
            s.substring(start.coerceIn(0, s.length), end.coerceIn(0, s.length))
        }

        "d2:split" -> {
            val s = args.getOrNull(0)?.toString() ?: ""
            val sep = args.getOrNull(1)?.toString() ?: ""
            val n = asDouble(args.getOrNull(2))?.toInt() ?: 0
            s.split(sep).getOrNull(n) ?: ""
        }

        "d2:validatePattern" -> {
            val v = args.getOrNull(0)?.toString() ?: ""
            val pat = args.getOrNull(1)?.toString() ?: ""
            runCatching { Regex(pat).matches(v) }.getOrElse { false }
        }

        "d2:left" -> {
            val s = args.getOrNull(0)?.toString() ?: ""
            val n = asDouble(args.getOrNull(1))?.toInt() ?: 0
            s.take(n.coerceAtLeast(0))
        }
        "d2:right" -> {
            val s = args.getOrNull(0)?.toString() ?: ""
            val n = asDouble(args.getOrNull(1))?.toInt() ?: 0
            s.takeLast(n.coerceAtLeast(0))
        }

        else -> null
    }

    private fun asDouble(v: Any?): Double? = when (v) {
        is Number -> v.toDouble()
        is String -> v.toDoubleOrNull()
        is Boolean -> if (v) 1.0 else 0.0
        else -> null
    }

    private fun parseDate(v: Any?): LocalDate? = runCatching {
        LocalDate.parse((v?.toString() ?: "").take(10))
    }.getOrElse {
        if (it is DateTimeParseException) null else null
    }

    private fun daysBetween(a: Any?, b: Any?): Long? {
        val da = parseDate(a) ?: return null
        val db = parseDate(b) ?: return null
        return java.time.temporal.ChronoUnit.DAYS.between(da, db)
    }

    private fun monthsBetween(a: Any?, b: Any?): Long? {
        val da = parseDate(a) ?: return null
        val db = parseDate(b) ?: return null
        return java.time.temporal.ChronoUnit.MONTHS.between(da, db)
    }

    private fun yearsBetween(a: Any?, b: Any?): Long? {
        val da = parseDate(a) ?: return null
        val db = parseDate(b) ?: return null
        return Period.between(da, db).years.toLong()
    }

    private fun addDays(a: Any?, days: Any?): String? {
        val da = parseDate(a) ?: return null
        val d = asDouble(days)?.toLong() ?: return null
        return da.plusDays(d).toString()
    }
}
