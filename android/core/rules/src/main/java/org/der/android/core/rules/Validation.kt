package org.der.android.core.rules

/**
 * DHIS2 aggregate-dataset validation rule — same expression engine
 * as program rules, different variable namespace (dataElements keyed
 * by UID, no runtime variables declared on the rule side). Used by
 * DER Data Entry at save time.
 */
data class ValidationRule(
    val id: String,
    val name: String,
    val importance: Importance,
    val operator: Operator,
    val leftSide: String,
    val rightSide: String,
) {
    enum class Importance { HIGH, MEDIUM, LOW }
    enum class Operator {
        EQUAL_TO,
        NOT_EQUAL_TO,
        LESS_THAN,
        LESS_THAN_OR_EQUAL_TO,
        GREATER_THAN,
        GREATER_THAN_OR_EQUAL_TO,
        COMPULSORY_PAIR,
        EXCLUSIVE_PAIR;

        companion object {
            fun parse(raw: String?): Operator = runCatching {
                if (raw == null) EQUAL_TO else valueOf(raw.uppercase())
            }.getOrElse { EQUAL_TO }
        }
    }

    companion object {
        fun importance(raw: String?): Importance = runCatching {
            if (raw == null) Importance.MEDIUM else Importance.valueOf(raw.uppercase())
        }.getOrElse { Importance.MEDIUM }
    }
}

data class ValidationResult(
    val ruleId: String,
    val ruleName: String,
    val importance: ValidationRule.Importance,
    val message: String,
)

/**
 * Runs every rule's left/right expressions against the current form
 * values and returns the list that violated. An empty list means the
 * dataset is clean to save.
 */
class ValidationEngine(private val rules: List<ValidationRule>) {

    fun validate(values: Map<String, String?>): List<ValidationResult> {
        val ev = ExpressionEvaluator(values.mapValues { it.value })
        val out = mutableListOf<ValidationResult>()
        for (rule in rules) {
            val left = ev.evaluate(rule.leftSide)
            val right = ev.evaluate(rule.rightSide)
            if (!satisfied(left, right, rule.operator)) {
                out += ValidationResult(
                    ruleId = rule.id,
                    ruleName = rule.name,
                    importance = rule.importance,
                    message = "${rule.name}: ${rule.leftSide} ${describe(rule.operator)} ${rule.rightSide}",
                )
            }
        }
        return out
    }

    private fun satisfied(a: Any?, b: Any?, op: ValidationRule.Operator): Boolean {
        // DHIS2 hasValue semantics: null, empty, blank all count as
        // absent — pair rules operate on that signal, not on raw
        // reference equality.
        val aPresent = hasValue(a)
        val bPresent = hasValue(b)
        if (op == ValidationRule.Operator.COMPULSORY_PAIR) return aPresent == bPresent
        if (op == ValidationRule.Operator.EXCLUSIVE_PAIR) return aPresent != bPresent

        val da = asDouble(a); val db = asDouble(b)
        if (da != null && db != null) {
            return when (op) {
                ValidationRule.Operator.EQUAL_TO -> da == db
                ValidationRule.Operator.NOT_EQUAL_TO -> da != db
                ValidationRule.Operator.LESS_THAN -> da < db
                ValidationRule.Operator.LESS_THAN_OR_EQUAL_TO -> da <= db
                ValidationRule.Operator.GREATER_THAN -> da > db
                ValidationRule.Operator.GREATER_THAN_OR_EQUAL_TO -> da >= db
                else -> true
            }
        }
        val sa = a?.toString(); val sb = b?.toString()
        return when (op) {
            ValidationRule.Operator.EQUAL_TO -> sa == sb
            ValidationRule.Operator.NOT_EQUAL_TO -> sa != sb
            else -> true
        }
    }

    private fun hasValue(v: Any?): Boolean = when (v) {
        null -> false
        is String -> v.isNotBlank() && !v.equals("null", ignoreCase = true)
        else -> true
    }

    private fun describe(op: ValidationRule.Operator): String = when (op) {
        ValidationRule.Operator.EQUAL_TO -> "=="
        ValidationRule.Operator.NOT_EQUAL_TO -> "!="
        ValidationRule.Operator.LESS_THAN -> "<"
        ValidationRule.Operator.LESS_THAN_OR_EQUAL_TO -> "<="
        ValidationRule.Operator.GREATER_THAN -> ">"
        ValidationRule.Operator.GREATER_THAN_OR_EQUAL_TO -> ">="
        ValidationRule.Operator.COMPULSORY_PAIR -> "must pair with"
        ValidationRule.Operator.EXCLUSIVE_PAIR -> "must exclude"
    }

    private fun asDouble(v: Any?): Double? = when (v) {
        is Number -> v.toDouble()
        is String -> v.toDoubleOrNull()
        is Boolean -> if (v) 1.0 else 0.0
        else -> null
    }
}
