package org.der.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.auth.BiometricPreference
import org.der.android.core.auth.SessionRepository
import javax.inject.Inject

/**
 * Decides which nav root to show on cold start:
 *   - no cached session → SignIn
 *   - cached session + biometric required → Unlock (gated)
 *   - cached session + no biometric required → Home
 *
 * The Unlock screen calls [markUnlocked] on success, which flips
 * the gate to Home for the session's lifetime.
 */
@HiltViewModel
class SessionGateViewModel @Inject constructor(
    private val sessionRepository: SessionRepository,
    private val biometricPreference: BiometricPreference,
) : ViewModel() {

    sealed interface State {
        data object Loading : State
        data class Ready(val start: Start) : State
    }

    enum class Start { SIGN_IN, UNLOCK, HOME }

    private val _state = MutableStateFlow<State>(State.Loading)
    val state: StateFlow<State> = _state.asStateFlow()

    private var unlocked = false

    init {
        viewModelScope.launch {
            val session = sessionRepository.current()
            val requireBiometric = biometricPreference.current()
            val start = when {
                session == null -> Start.SIGN_IN
                requireBiometric && !unlocked -> Start.UNLOCK
                else -> Start.HOME
            }
            _state.value = State.Ready(start)
        }
    }

    fun markUnlocked() {
        unlocked = true
        _state.update { current ->
            if (current is State.Ready) State.Ready(Start.HOME) else current
        }
    }
}
