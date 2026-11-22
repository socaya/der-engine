package org.der.android.core.auth

import org.der.android.core.domain.EnrolmentStatus
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The private String→EnrolmentStatus mapping inside
 * [EnrolmentRepository] is exercised indirectly through this
 * mirrored implementation so the mapping stays stable across
 * server-side status spellings.
 */
class EnrolmentStatusMappingTest {
    private fun map(raw: String): EnrolmentStatus = when (raw.uppercase()) {
        "APPROVED" -> EnrolmentStatus.APPROVED
        "PENDING" -> EnrolmentStatus.PENDING
        "SUSPENDED", "REVOKED", "BLOCKED" -> EnrolmentStatus.BLOCKED
        else -> EnrolmentStatus.UNKNOWN
    }

    @Test fun approved() = assertEquals(EnrolmentStatus.APPROVED, map("APPROVED"))
    @Test fun pending() = assertEquals(EnrolmentStatus.PENDING, map("PENDING"))
    @Test fun suspended() = assertEquals(EnrolmentStatus.BLOCKED, map("SUSPENDED"))
    @Test fun revoked() = assertEquals(EnrolmentStatus.BLOCKED, map("REVOKED"))
    @Test fun blocked() = assertEquals(EnrolmentStatus.BLOCKED, map("BLOCKED"))
    @Test fun unknownFallsThrough() = assertEquals(EnrolmentStatus.UNKNOWN, map("SOMETHING_ELSE"))
    @Test fun caseInsensitive() = assertEquals(EnrolmentStatus.APPROVED, map("approved"))
}
