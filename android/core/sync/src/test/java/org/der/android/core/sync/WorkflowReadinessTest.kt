package org.der.android.core.sync

import org.der.android.core.domain.Readiness
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Locks the server→client readiness enum mapping. If the server adds
 * a new readiness variant, the parser falls back to UNKNOWN so the
 * UI can render the row safely until the Android client catches up.
 */
class WorkflowReadinessTest {
    @Test fun ready() = assertEquals(Readiness.READY, Readiness.parse("READY"))
    @Test fun blocked() = assertEquals(Readiness.BLOCKED, Readiness.parse("BLOCKED"))
    @Test fun pending() = assertEquals(Readiness.PENDING, Readiness.parse("PENDING"))
    @Test fun done() = assertEquals(Readiness.DONE, Readiness.parse("DONE"))
    @Test fun caseInsensitive() = assertEquals(Readiness.READY, Readiness.parse("ready"))
    @Test fun unknownFutureVariant() =
        assertEquals(Readiness.UNKNOWN, Readiness.parse("AWAITING_LAB"))
    @Test fun nullIsUnknown() =
        assertEquals(Readiness.UNKNOWN, Readiness.parse(null))
}
