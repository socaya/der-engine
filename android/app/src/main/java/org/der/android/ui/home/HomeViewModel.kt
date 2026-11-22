package org.der.android.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.der.android.core.auth.SessionRepository
import org.der.android.core.domain.Session
import javax.inject.Inject

/**
 * Backs the launcher shell. Besides tiles + sign-out, it watches the
 * stored session's `expiresAt` and exposes a "expiring soon" signal
 * that the shell renders as a banner with a "Keep me signed in"
 * action. The action calls `/auth/session`, which — because the
 * cookie-based session is still valid — bumps `expiresAt` forward.
 */
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val sessionRepository: SessionRepository,
) : ViewModel() {

    val session: StateFlow<Session?> = sessionRepository.session
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val tick = MutableStateFlow(0L)

    /**
     * Fires every 30 s so the countdown banner updates without the
     * composable having to spin its own timer.
     */
    init {
        viewModelScope.launch {
            while (true) {
                delay(30_000)
                tick.value = tick.value + 1
            }
        }
    }

    val expiry: StateFlow<ExpiryState> = combine(session, tick) { s, _ ->
        if (s == null) ExpiryState.None
        else {
            val mins = s.minutesUntilExpiry()
            when {
                mins <= 0 -> ExpiryState.Expired
                mins <= WARN_THRESHOLD_MIN -> ExpiryState.ExpiringSoon(mins.toInt())
                else -> ExpiryState.Ok
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ExpiryState.None)

    private val _renewing = MutableStateFlow(false)
    val renewing: StateFlow<Boolean> = _renewing.asStateFlow()

    fun onResume() {
        viewModelScope.launch { sessionRepository.refresh() }
    }

    fun keepSignedIn() {
        if (_renewing.value) return
        _renewing.value = true
        viewModelScope.launch {
            sessionRepository.refresh()
            _renewing.value = false
        }
    }

    fun signOut(onComplete: () -> Unit) {
        viewModelScope.launch {
            sessionRepository.signOut()
            onComplete()
        }
    }

    sealed interface ExpiryState {
        data object None : ExpiryState
        data object Ok : ExpiryState
        data class ExpiringSoon(val minutesLeft: Int) : ExpiryState
        data object Expired : ExpiryState
    }

    companion object { const val WARN_THRESHOLD_MIN = 10L }
}
