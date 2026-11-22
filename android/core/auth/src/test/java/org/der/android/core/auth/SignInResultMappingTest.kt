package org.der.android.core.auth

import org.der.android.core.data.network.SignInResponseDto
import org.der.android.core.domain.Session
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The [SessionRepository.signIn] closure is heavy to instantiate under
 * JVM (DataStore wants a Context). Instead we exercise the pure mapping
 * from the server DTO to the domain [Session] — the thin arithmetic
 * that must stay stable across phases.
 */
class SignInResultMappingTest {
    @Test fun dtoMapsToDomainSession() {
        val dto = SignInResponseDto(
            userId = "u1",
            username = "chw.jane",
            displayName = "Jane C.",
            roles = listOf("ROLE_CHW"),
            expiresAt = "2026-11-22T20:00:00Z",
        )
        val session = Session(
            userId = dto.userId,
            username = dto.username,
            displayName = dto.displayName,
            roles = dto.roles,
            expiresAt = dto.expiresAt,
        )
        assertEquals("u1", session.userId)
        assertEquals("chw.jane", session.username)
        assertEquals("Jane C.", session.displayName)
        assertEquals(listOf("ROLE_CHW"), session.roles)
    }

    @Test fun adminRoleFlagsAdmin() {
        val s = Session("u", "u", null, listOf("ROLE_ADMIN"), "2026-11-22T20:00:00Z")
        assertEquals(true, s.isAdmin)
    }

    @Test fun supervisorRoleFlagsSupervisor() {
        val s = Session("u", "u", null, listOf("ROLE_SUPERVISOR"), "2026-11-22T20:00:00Z")
        assertEquals(true, s.isSupervisor)
        assertEquals(false, s.isAdmin)
    }
}
