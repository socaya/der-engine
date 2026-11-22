package org.der.android.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.der.android.core.auth.SessionRepository
import org.der.android.core.domain.Session
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val sessionRepository: SessionRepository,
) : ViewModel() {

    val session: StateFlow<Session?> = sessionRepository.session
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun signOut(onComplete: () -> Unit) {
        viewModelScope.launch {
            sessionRepository.signOut()
            onComplete()
        }
    }
}
