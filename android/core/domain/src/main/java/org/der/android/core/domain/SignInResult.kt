package org.der.android.core.domain

/**
 * Outcome of a sign-in attempt. Modelled as a sealed interface so the
 * UI layer can pattern-match without reaching for exception handling.
 */
sealed interface SignInResult {
    data class Success(val session: Session) : SignInResult
    data object InvalidCredentials : SignInResult
    data class ServerUnreachable(val reason: String) : SignInResult
    data class DeviceNotApproved(val deviceId: String) : SignInResult
    data class Unknown(val reason: String) : SignInResult
}
