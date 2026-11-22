package org.der.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.der.android.core.auth.SessionRepository
import javax.inject.Inject

/**
 * Decides which nav root to show on cold start. Reads the cached
 * session from [SessionRepository] once, emits [State.Ready] with
 * whether a session exists, and leaves further session changes to
 * the screens that care about them.
 */
@HiltViewModel
class SessionGateViewModel @Inject constructor(
    private val sessionRepository: SessionRepository,
) : ViewModel() {

    sealed interface State {
        data object Loading : State
        data class Ready(val authenticated: Boolean) : State
    }

    private val _state = MutableStateFlow<State>(State.Loading)
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val session = sessionRepository.current()
            _state.value = State.Ready(authenticated = session != null)
        }
    }
}
