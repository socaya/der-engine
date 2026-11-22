package org.der.android.core.rules

import java.time.LocalDate

/**
 * Pure-Kotlin program rule engine. Given the metadata (rules +
 * variables) for a program/stage and the operator's current form
 * state (dataElementId → value), returns the list of effects the UI
 * must apply.
 *
 * Deliberately stateless: the UI calls [evaluate] on every value
 * change; perf is fine because the common pilot programme has ≤ 50
 * rules.
 */
class RuleEngine(
    private val variables: List<ProgramRuleVariable>,
    private val rules: List<ProgramRule>,
) {

    fun evaluate(
        programStageId: String?,
        values: Map<String, String?>,
        env: Map<String, Any?> = defaultEnv(),
    ): RuleEvaluation {
        // Build the named-variable lookup table.
        val resolved: Map<String, Any?> = buildMap {
            for (v in variables) {
                val raw = when (v.sourceType) {
                    VariableSourceType.DATAELEMENT_CURRENT_EVENT,
                    VariableSourceType.DATAELEMENT_NEWEST_EVENT_PROGRAM,
                    VariableSourceType.DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE,
                    VariableSourceType.DATAELEMENT_PREVIOUS_EVENT ->
                        v.dataElementId?.let { values[it] }
                    VariableSourceType.TEI_ATTRIBUTE ->
                        v.trackedEntityAttributeId?.let { values[it] }
                    VariableSourceType.CALCULATED_VALUE -> null
                    VariableSourceType.UNKNOWN -> null
                }
                put(v.name, coerce(raw, v.valueType))
            }
            // A{UID} — also expose each data-element value under its UID
            // so rules that reference `A{uid}` directly resolve.
            values.forEach { (uid, value) -> putIfAbsent(uid, value) }
        }

        val ev = ExpressionEvaluator(resolved, env)
        val effects = mutableListOf<RuleEffect>()
        // Sort by server-side priority DESC so higher-priority rules
        // win when they target the same field.
        val ordered = rules
            .filter { it.programStageId == null || it.programStageId == programStageId }
            .sortedByDescending { it.priority ?: 0 }

        for (rule in ordered) {
            val fired = runCatching { ev.evaluateBoolean(rule.condition) }.getOrElse { false }
            if (!fired) continue
            for (a in rule.actions) {
                addEffectsFor(rule.id, a, ev, effects)
            }
        }
        return RuleEvaluation(effects)
    }

    private fun addEffectsFor(
        ruleId: String,
        a: ProgramRuleAction,
        ev: ExpressionEvaluator,
        out: MutableList<RuleEffect>,
    ) {
        val target = a.dataElementId ?: a.trackedEntityAttributeId
        when (a.type) {
            ProgramRuleActionType.HIDE_FIELD ->
                target?.let { out += RuleEffect.HideField(ruleId, it) }

            ProgramRuleActionType.HIDE_SECTION ->
                a.programStageSectionId?.let { out += RuleEffect.HideSection(ruleId, it) }

            ProgramRuleActionType.SHOW_WARNING ->
                out += RuleEffect.ShowWarning(
                    ruleId,
                    message = composeMessage(a, ev),
                    fieldId = target,
                )
            ProgramRuleActionType.WARNING_ON_COMPLETE ->
                out += RuleEffect.ShowWarning(
                    ruleId,
                    message = composeMessage(a, ev),
                    fieldId = target,
                    onComplete = true,
                )

            ProgramRuleActionType.SHOW_ERROR ->
                out += RuleEffect.ShowError(
                    ruleId,
                    message = composeMessage(a, ev),
                    fieldId = target,
                )
            ProgramRuleActionType.ERROR_ON_COMPLETE ->
                out += RuleEffect.ShowError(
                    ruleId,
                    message = composeMessage(a, ev),
                    fieldId = target,
                    onComplete = true,
                )

            ProgramRuleActionType.SET_MANDATORY_FIELD ->
                target?.let { out += RuleEffect.SetMandatory(ruleId, it) }

            ProgramRuleActionType.ASSIGN -> {
                val tgt = target ?: return
                val value = a.data?.let { ev.evaluateString(it) }
                out += RuleEffect.Assign(ruleId, tgt, value)
            }

            ProgramRuleActionType.DISPLAY_TEXT,
            ProgramRuleActionType.DISPLAY_KEY_VALUE_PAIR ->
                out += RuleEffect.DisplayText(
                    ruleId,
                    location = a.location,
                    content = composeMessage(a, ev),
                )

            ProgramRuleActionType.HIDE_OPTION ->
                if (target != null && a.data != null)
                    out += RuleEffect.HideOption(ruleId, target, a.data)

            // Below are recognised but not yet wired through — surfaced
            // as a no-op so an unknown pilot programme doesn't crash
            // the client.
            ProgramRuleActionType.CREATE_EVENT,
            ProgramRuleActionType.SCHEDULE_MESSAGE,
            ProgramRuleActionType.SEND_MESSAGE,
            ProgramRuleActionType.SHOW_OPTION_GROUP,
            ProgramRuleActionType.HIDE_OPTION_GROUP,
            ProgramRuleActionType.UNKNOWN -> { /* no-op */ }
        }
    }

    private fun composeMessage(
        a: ProgramRuleAction,
        ev: ExpressionEvaluator,
    ): String {
        val head = a.content.orEmpty()
        val tail = a.data?.let { ev.evaluateString(it) }.orEmpty()
        return if (tail.isNotEmpty()) "$head $tail".trim() else head
    }

    /**
     * DHIS2 variable types matter for the rule-engine arithmetic. We
     * coerce to the type the server declared so `A{weight} > 50`
     * works even when the raw DOM value is `"50.5"`.
     */
    private fun coerce(raw: String?, valueType: String?): Any? {
        if (raw.isNullOrBlank()) return null
        return when (valueType?.uppercase()) {
            "NUMBER", "PERCENTAGE", "INTEGER", "INTEGER_POSITIVE",
            "INTEGER_ZERO_OR_POSITIVE", "INTEGER_NEGATIVE",
            "UNIT_INTERVAL" -> raw.toDoubleOrNull() ?: raw
            "BOOLEAN", "TRUE_ONLY" -> raw.equals("true", true) || raw == "1"
            "DATE", "DATETIME" -> raw
            else -> raw
        }
    }

    companion object {
        fun defaultEnv(today: LocalDate = LocalDate.now()): Map<String, Any?> = mapOf(
            "current_date" to today.toString(),
            "completed_date" to today.toString(),
            "event_date" to today.toString(),
            "enrollment_date" to today.toString(),
            "org_unit_count" to 1,
            "environment" to "ANDROID",
            "program_stage_id" to "",
            "program_stage_name" to "",
        )
    }
}
