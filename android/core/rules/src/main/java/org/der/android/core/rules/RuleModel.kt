package org.der.android.core.rules

/**
 * Minimal mirror of DHIS2's program-rule model, kept narrow to the
 * fields DER's rule engine actually reads. Decoded from
 * `/api/programRules` + `/api/programRuleActions` +
 * `/api/programRuleVariables`.
 */

data class ProgramRule(
    val id: String,
    val name: String,
    val programId: String?,
    val programStageId: String?,
    val condition: String,
    val priority: Int?,
    val actions: List<ProgramRuleAction>,
)

enum class ProgramRuleActionType {
    HIDE_FIELD,
    HIDE_SECTION,
    SHOW_WARNING,
    SHOW_ERROR,
    WARNING_ON_COMPLETE,
    ERROR_ON_COMPLETE,
    SET_MANDATORY_FIELD,
    ASSIGN,
    DISPLAY_TEXT,
    DISPLAY_KEY_VALUE_PAIR,
    HIDE_OPTION,
    SHOW_OPTION_GROUP,
    HIDE_OPTION_GROUP,
    CREATE_EVENT,
    SCHEDULE_MESSAGE,
    SEND_MESSAGE,
    UNKNOWN;

    companion object {
        fun parse(raw: String?): ProgramRuleActionType = runCatching {
            if (raw == null) UNKNOWN else valueOf(raw.uppercase())
        }.getOrElse { UNKNOWN }
    }
}

data class ProgramRuleAction(
    val id: String,
    val type: ProgramRuleActionType,
    /** Text shown by SHOW_WARNING / SHOW_ERROR / DISPLAY_TEXT. */
    val content: String? = null,
    /** Expression evaluated by ASSIGN (its result is the field value)
     *  or appended to a [content] message. */
    val data: String? = null,
    val dataElementId: String? = null,
    val trackedEntityAttributeId: String? = null,
    val programStageId: String? = null,
    val programStageSectionId: String? = null,
    val location: String? = null,
)

enum class VariableSourceType {
    DATAELEMENT_NEWEST_EVENT_PROGRAM,
    DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE,
    DATAELEMENT_CURRENT_EVENT,
    DATAELEMENT_PREVIOUS_EVENT,
    CALCULATED_VALUE,
    TEI_ATTRIBUTE,
    UNKNOWN;

    companion object {
        fun parse(raw: String?): VariableSourceType = runCatching {
            if (raw == null) UNKNOWN else valueOf(raw.uppercase())
        }.getOrElse { UNKNOWN }
    }
}

data class ProgramRuleVariable(
    val id: String,
    val name: String,
    val sourceType: VariableSourceType,
    val dataElementId: String? = null,
    val trackedEntityAttributeId: String? = null,
    val programStageId: String? = null,
    val valueType: String? = null,
    val useCodeForOptionSet: Boolean = false,
)

/**
 * The effects the engine reports back to the UI. Multiple effects
 * can target the same field — HIDE_FIELD trumps SET_MANDATORY_FIELD;
 * ASSIGN wins over manual entry; ERROR flags block save.
 */
sealed interface RuleEffect {
    val sourceRuleId: String

    data class HideField(override val sourceRuleId: String, val fieldId: String) : RuleEffect
    data class HideSection(override val sourceRuleId: String, val sectionId: String) : RuleEffect
    data class ShowWarning(
        override val sourceRuleId: String,
        val message: String,
        val fieldId: String?,
        val onComplete: Boolean = false,
    ) : RuleEffect
    data class ShowError(
        override val sourceRuleId: String,
        val message: String,
        val fieldId: String?,
        val onComplete: Boolean = false,
    ) : RuleEffect
    data class SetMandatory(
        override val sourceRuleId: String,
        val fieldId: String,
    ) : RuleEffect
    data class Assign(
        override val sourceRuleId: String,
        val fieldId: String,
        val value: String?,
    ) : RuleEffect
    data class HideOption(
        override val sourceRuleId: String,
        val fieldId: String,
        val optionCode: String,
    ) : RuleEffect
    data class DisplayText(
        override val sourceRuleId: String,
        val location: String?,
        val content: String,
    ) : RuleEffect
}

/**
 * Rolled view the UI consumes to render + validate a form.
 */
data class RuleEvaluation(
    val effects: List<RuleEffect>,
) {
    val hiddenFields: Set<String> = effects
        .filterIsInstance<RuleEffect.HideField>().map { it.fieldId }.toSet()
    val hiddenSections: Set<String> = effects
        .filterIsInstance<RuleEffect.HideSection>().map { it.sectionId }.toSet()
    val mandatoryFields: Set<String> = effects
        .filterIsInstance<RuleEffect.SetMandatory>().map { it.fieldId }.toSet()
    val assignments: Map<String, String?> = effects
        .filterIsInstance<RuleEffect.Assign>().associate { it.fieldId to it.value }
    val warnings: List<RuleEffect.ShowWarning> =
        effects.filterIsInstance<RuleEffect.ShowWarning>()
    val errors: List<RuleEffect.ShowError> =
        effects.filterIsInstance<RuleEffect.ShowError>()
    val displayTexts: List<RuleEffect.DisplayText> =
        effects.filterIsInstance<RuleEffect.DisplayText>()
    val hiddenOptions: Map<String, Set<String>> = effects
        .filterIsInstance<RuleEffect.HideOption>()
        .groupBy { it.fieldId }
        .mapValues { entry -> entry.value.map { it.optionCode }.toSet() }

    /** True when at least one SHOW_ERROR (non-complete-gated) fires. */
    val hasBlockingErrors: Boolean get() = errors.any { !it.onComplete }

    /** Combined blocking errors on save-complete — mandatory + ERRORs. */
    fun blockingErrorsOnComplete(presentFields: Set<String>): List<String> = buildList {
        errors.forEach { add(it.message) }
        mandatoryFields.forEach { field ->
            if (field !in presentFields) add("Field $field is required.")
        }
    }
}
