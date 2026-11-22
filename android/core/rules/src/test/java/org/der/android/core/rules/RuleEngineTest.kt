package org.der.android.core.rules

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RuleEngineTest {

    private val vars = listOf(
        ProgramRuleVariable(
            id = "v1",
            name = "age",
            sourceType = VariableSourceType.DATAELEMENT_CURRENT_EVENT,
            dataElementId = "DE_AGE",
            valueType = "NUMBER",
        ),
    )

    @Test fun hideField() {
        val engine = RuleEngine(
            variables = vars,
            rules = listOf(
                ProgramRule(
                    id = "r1", name = "Hide if child",
                    programId = "P", programStageId = null,
                    condition = "#{age} < 18",
                    priority = null,
                    actions = listOf(
                        ProgramRuleAction(
                            id = "a1",
                            type = ProgramRuleActionType.HIDE_FIELD,
                            dataElementId = "DE_PREGNANCY",
                        ),
                    ),
                ),
            ),
        )
        val eval = engine.evaluate(null, mapOf("DE_AGE" to "7"))
        assertTrue("DE_PREGNANCY" in eval.hiddenFields)
    }

    @Test fun assignComputedValue() {
        val vars2 = listOf(
            ProgramRuleVariable("v", "weight",
                VariableSourceType.DATAELEMENT_CURRENT_EVENT, "DE_W", valueType = "NUMBER"),
            ProgramRuleVariable("v", "height",
                VariableSourceType.DATAELEMENT_CURRENT_EVENT, "DE_H", valueType = "NUMBER"),
        )
        val engine = RuleEngine(
            variables = vars2,
            rules = listOf(
                ProgramRule(
                    id = "r2", name = "BMI",
                    programId = "P", programStageId = null,
                    condition = "d2:hasValue(#{weight}) && d2:hasValue(#{height})",
                    priority = null,
                    actions = listOf(
                        ProgramRuleAction(
                            id = "a2",
                            type = ProgramRuleActionType.ASSIGN,
                            data = "#{weight} / (#{height} * #{height})",
                            dataElementId = "DE_BMI",
                        ),
                    ),
                ),
            ),
        )
        val eval = engine.evaluate(null, mapOf("DE_W" to "80", "DE_H" to "2"))
        assertEquals("20", eval.assignments["DE_BMI"])
    }

    @Test fun showErrorBlocks() {
        val engine = RuleEngine(
            variables = vars,
            rules = listOf(
                ProgramRule(
                    id = "r3", name = "age sanity",
                    programId = "P", programStageId = null,
                    condition = "#{age} > 130",
                    priority = null,
                    actions = listOf(
                        ProgramRuleAction(
                            id = "a3",
                            type = ProgramRuleActionType.SHOW_ERROR,
                            content = "Age looks wrong",
                        ),
                    ),
                ),
            ),
        )
        val eval = engine.evaluate(null, mapOf("DE_AGE" to "250"))
        assertTrue(eval.hasBlockingErrors)
    }

    @Test fun setMandatoryFlagged() {
        val engine = RuleEngine(
            variables = vars,
            rules = listOf(
                ProgramRule(
                    id = "r4", name = "mandatory on adult",
                    programId = "P", programStageId = null,
                    condition = "#{age} >= 18",
                    priority = null,
                    actions = listOf(
                        ProgramRuleAction(
                            id = "a4",
                            type = ProgramRuleActionType.SET_MANDATORY_FIELD,
                            dataElementId = "DE_HIV",
                        ),
                    ),
                ),
            ),
        )
        val eval = engine.evaluate(null, mapOf("DE_AGE" to "30"))
        assertTrue("DE_HIV" in eval.mandatoryFields)
        val evalChild = engine.evaluate(null, mapOf("DE_AGE" to "7"))
        assertFalse("DE_HIV" in evalChild.mandatoryFields)
    }

    @Test fun stageScopedRuleDoesNotFireAcrossStages() {
        val engine = RuleEngine(
            variables = vars,
            rules = listOf(
                ProgramRule(
                    id = "r5", name = "stage-scoped",
                    programId = "P", programStageId = "STAGE-A",
                    condition = "#{age} > 0",
                    priority = null,
                    actions = listOf(
                        ProgramRuleAction(
                            id = "a5",
                            type = ProgramRuleActionType.HIDE_FIELD,
                            dataElementId = "DE_SECRET",
                        ),
                    ),
                ),
            ),
        )
        val evalA = engine.evaluate("STAGE-A", mapOf("DE_AGE" to "5"))
        assertTrue("DE_SECRET" in evalA.hiddenFields)
        val evalB = engine.evaluate("STAGE-B", mapOf("DE_AGE" to "5"))
        assertFalse("DE_SECRET" in evalB.hiddenFields)
    }
}
