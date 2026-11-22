package org.der.android.ui.signin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.auth.SessionRepository
import org.der.android.core.domain.SignInResult
import javax.inject.Inject

/**
 * UI state machine for the sign-in screen. Delegates the actual
 * credential exchange to [SessionRepository] so the ViewModel stays
 * thin — the only logic here is user-facing status and error text.
 */
@HiltViewModel
class SignInViewModel @Inject constructor(
    private val sessionRepository: SessionRepository,
) : ViewModel() {

    data class UiState(
        val username: String = "",
        val password: String = "",
        val revealed: Boolean = false,
        val submitting: Boolean = false,
        val error: String? = null,
        val signedIn: Boolean = false,
        val deviceNotApproved: Boolean = false,
    ) {
        val canSubmit: Boolean
            get() = !submitting && username.isNotBlank() && password.isNotBlank()
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    fun onUsername(v: String) = _state.update { it.copy(username = v, error = null) }
    fun onPassword(v: String) = _state.update { it.copy(password = v, error = null) }
    fun toggleReveal() = _state.update { it.copy(revealed = !it.revealed) }

    fun submit() {
        val s = _state.value
        if (!s.canSubmit) return
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            val result = sessionRepository.signIn(s.username, s.password)
            _state.update {
                when (result) {
                    is SignInResult.Success ->
                        it.copy(submitting = false, signedIn = true)
                    is SignInResult.DeviceNotApproved ->
                        it.copy(submitting = false, deviceNotApproved = true)
                    SignInResult.InvalidCredentials ->
                        it.copy(submitting = false, error = "Username or password is wrong.")
                    is SignInResult.ServerUnreachable ->
                        it.copy(submitting = false, error = "Can’t reach this DER edge. Check Wi-Fi + server URL.")
                    is SignInResult.Unknown ->
                        it.copy(submitting = false, error = "Sign-in failed: ${result.reason}")
                }
            }
        }
    }
}
