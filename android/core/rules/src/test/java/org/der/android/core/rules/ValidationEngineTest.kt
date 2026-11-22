package org.der.android.core.rules

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ValidationEngineTest {

    @Test fun leftLessThanRight() {
        val rules = listOf(
            ValidationRule(
                id = "r", name = "children <= attended",
                importance = ValidationRule.Importance.HIGH,
                operator = ValidationRule.Operator.LESS_THAN_OR_EQUAL_TO,
                leftSide = "#{children_u5}",
                rightSide = "#{sessions_attended}",
            ),
        )
        val engine = ValidationEngine(rules)
        assertTrue(engine.validate(mapOf("children_u5" to "10", "sessions_attended" to "5")).isNotEmpty())
        assertTrue(engine.validate(mapOf("children_u5" to "3", "sessions_attended" to "5")).isEmpty())
    }

    @Test fun compulsoryPairDemandsBothOrNeither() {
        val rules = listOf(
            ValidationRule(
                id = "r", name = "age + sex together",
                importance = ValidationRule.Importance.MEDIUM,
                operator = ValidationRule.Operator.COMPULSORY_PAIR,
                leftSide = "#{age}",
                rightSide = "#{sex}",
            ),
        )
        val engine = ValidationEngine(rules)
        // One filled, one empty → violates.
        assertFalse(engine.validate(mapOf("age" to "7", "sex" to "")).isEmpty())
        // Both filled → OK.
        assertTrue(engine.validate(mapOf("age" to "7", "sex" to "M")).isEmpty())
        // Both empty → also OK (we count that as "neither").
        assertTrue(engine.validate(mapOf("age" to "", "sex" to "")).isEmpty())
    }

    @Test fun importanceSurfaces() {
        val rules = listOf(
            ValidationRule(
                id = "r", name = "range",
                importance = ValidationRule.Importance.LOW,
                operator = ValidationRule.Operator.LESS_THAN,
                leftSide = "#{a}", rightSide = "100",
            ),
        )
        val results = ValidationEngine(rules).validate(mapOf("a" to "200"))
        assertEquals(1, results.size)
        assertEquals(ValidationRule.Importance.LOW, results.first().importance)
    }
}
