package org.der.android.core.sync

import org.der.android.core.data.network.DerApi
import org.der.android.core.rules.ProgramRule
import org.der.android.core.rules.ProgramRuleAction
import org.der.android.core.rules.ProgramRuleActionType
import org.der.android.core.rules.ProgramRuleVariable
import org.der.android.core.rules.RuleEngine
import org.der.android.core.rules.ValidationEngine
import org.der.android.core.rules.ValidationRule
import org.der.android.core.rules.VariableSourceType
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Fetches rule + variable metadata from the DER mirror and composes
 * the [RuleEngine] + [ValidationEngine] instances the form screens
 * use.
 *
 * DHIS2 returns actions in a separate collection keyed by rule UID
 * — we join them client-side here, matching the web client's
 * behaviour.
 */
@Singleton
class RulesRepository @Inject constructor(private val api: DerApi) {

    suspend fun programEngine(programId: String): RuleEngine {
        val rulesResp = api.listProgramRules()
        val actionsResp = api.listProgramRuleActions()
        val varsResp = api.listProgramRuleVariables()

        val rawActions = actionsResp.body()?.programRuleActions.orEmpty()
        val actionsByRule = rawActions.groupBy { it.programRule?.id.orEmpty() }

        val rules: List<ProgramRule> = rulesResp.body()?.programRules.orEmpty()
            .asSequence()
            .filter { it.program?.id == programId }
            .mapNotNull { rr ->
                val rawRuleId = rr.id
                val condition = rr.condition ?: return@mapNotNull null
                ProgramRule(
                    id = rawRuleId,
                    name = rr.displayName ?: rr.name ?: rawRuleId,
                    programId = rr.program?.id,
                    programStageId = rr.programStage?.id,
                    condition = condition,
                    priority = rr.priority,
                    actions = actionsByRule[rawRuleId].orEmpty().map { a ->
                        ProgramRuleAction(
                            id = a.id,
                            type = ProgramRuleActionType.parse(a.type),
                            content = a.content,
                            data = a.data,
                            dataElementId = a.dataElement?.id,
                            trackedEntityAttributeId = a.trackedEntityAttribute?.id,
                            programStageId = a.programStage?.id,
                            programStageSectionId = a.programStageSection?.id,
                            location = a.location,
                        )
                    },
                )
            }
            .toList()

        val variables: List<ProgramRuleVariable> = varsResp.body()?.programRuleVariables.orEmpty()
            .asSequence()
            .filter { it.program?.id == programId }
            .mapNotNull { v ->
                val name = v.displayName ?: v.name ?: return@mapNotNull null
                ProgramRuleVariable(
                    id = v.id,
                    name = name,
                    sourceType = VariableSourceType.parse(v.sourceType),
                    dataElementId = v.dataElement?.id,
                    trackedEntityAttributeId = v.trackedEntityAttribute?.id,
                    programStageId = v.programStage?.id,
                    valueType = v.valueType,
                    useCodeForOptionSet = v.useCodeForOptionSet == true,
                )
            }
            .toList()

        return RuleEngine(variables = variables, rules = rules)
    }

    suspend fun validationEngine(dataSetId: String): ValidationEngine {
        val response = api.listValidationRules(dataSet = dataSetId)
        val rules = response.body()?.validationRules.orEmpty().map { v ->
            ValidationRule(
                id = v.id,
                name = v.name ?: v.id,
                importance = ValidationRule.importance(v.importance),
                operator = ValidationRule.Operator.parse(v.operator),
                leftSide = v.leftSide?.expression.orEmpty(),
                rightSide = v.rightSide?.expression.orEmpty(),
            )
        }
        return ValidationEngine(rules)
    }
}
