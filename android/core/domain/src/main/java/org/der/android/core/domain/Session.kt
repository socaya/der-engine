package org.der.android.core.domain

/**
 * The authenticated DER session returned by `/edge-api/v1/auth/sign-in`.
 * Mirrors `AuthController.SignInResponse` on the server. Keep this
 * class free of Android or framework types so Compose previews and
 * JVM unit tests can use it unchanged.
 */
data class Session(
    val userId: String,
    val username: String,
    val displayName: String?,
    val roles: List<String>,
    val expiresAt: String,
) {
    /**
     * `true` if the session carries any of the DER role tokens that
     * should see the admin surface (`ROLE_ADMIN`, `ROLE_SUPERUSER`).
     */
    val isAdmin: Boolean
        get() = roles.any { it == "ROLE_ADMIN" || it == "ROLE_SUPERUSER" }

    /**
     * `true` if the session carries supervisor privileges — used to
     * decide whether approvals + referral routes are visible.
     */
    val isSupervisor: Boolean
        get() = roles.any { it == "ROLE_SUPERVISOR" }

    /**
     * Minutes until the server-reported `expiresAt` elapses, computed
     * against the supplied clock. Returns `Long.MAX_VALUE` if the
     * stamp is unparseable (unknown horizon → never prompt).
     */
    fun minutesUntilExpiry(nowEpochMs: Long = System.currentTimeMillis()): Long = try {
        val expiry = java.time.Instant.parse(expiresAt).toEpochMilli()
        (expiry - nowEpochMs) / 60_000L
    } catch (_: Throwable) {
        Long.MAX_VALUE
    }
}
