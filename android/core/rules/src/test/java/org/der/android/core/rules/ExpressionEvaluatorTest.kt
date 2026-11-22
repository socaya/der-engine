package org.der.android.core.rules

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExpressionEvaluatorTest {

    private fun ev(vars: Map<String, Any?>): ExpressionEvaluator =
        ExpressionEvaluator(variables = vars)

    @Test fun literalAndArithmetic() {
        val e = ev(emptyMap())
        assertEquals(5.0, e.evaluate("2 + 3"))
        assertEquals(1.0, e.evaluate("(10 - 7) / 3"))
        assertEquals(6.0, e.evaluate("-3 * -2"))
    }

    @Test fun comparisonAndLogic() {
        val e = ev(mapOf("age" to 7))
        assertTrue(e.evaluateBoolean("#{age} < 10 && #{age} > 0"))
        assertFalse(e.evaluateBoolean("#{age} > 10 || #{age} < 0"))
    }

    @Test fun stringEquality() {
        val e = ev(mapOf("sex" to "M"))
        assertTrue(e.evaluateBoolean("#{sex} == 'M'"))
        assertFalse(e.evaluateBoolean("#{sex} != 'M'"))
    }

    @Test fun d2HasValueAndLength() {
        val e = ev(mapOf("name" to "Jane"))
        assertTrue(e.evaluateBoolean("d2:hasValue(#{name})"))
        assertEquals(4.0, (e.evaluate("d2:length(#{name})") as Number).toDouble(), 0.0)
    }

    @Test fun d2DatesBetween() {
        val e = ev(mapOf("dob" to "2020-01-01", "today" to "2026-11-22"))
        val years = e.evaluate("d2:yearsBetween(#{dob}, #{today})") as Long
        assertEquals(6L, years)
    }

    @Test fun d2ValidatePattern() {
        val e = ev(mapOf("phone" to "+256700123456"))
        assertTrue(e.evaluateBoolean("d2:validatePattern(#{phone}, '^\\+\\d{10,13}\$')"))
    }

    @Test fun missingVariableFallsToNullBoolean() {
        val e = ev(emptyMap())
        assertFalse(e.evaluateBoolean("#{missing}"))
        assertNull(e.evaluate("#{missing} + 1"))
    }

    @Test fun attributeReferenceByUid() {
        // A{UID} should resolve from the variable map keyed by UID.
        val e = ev(mapOf("DE-UID" to 42))
        assertEquals(42.0, (e.evaluate("A{DE-UID}") as Number).toDouble(), 0.0)
    }

    @Test fun ceilFloorRound() {
        val e = ev(emptyMap())
        assertEquals(3.0, e.evaluate("d2:ceil(2.1)"))
        assertEquals(2.0, e.evaluate("d2:floor(2.9)"))
        assertEquals(3.0, e.evaluate("d2:round(2.5)"))
    }
}
