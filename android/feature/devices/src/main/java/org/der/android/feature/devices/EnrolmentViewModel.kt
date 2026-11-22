package org.der.android.feature.devices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.auth.EnrolmentRepository
import org.der.android.core.auth.SessionRepository
import org.der.android.core.domain.DeviceEnrolment
import org.der.android.core.domain.EnrolmentStatus
import javax.inject.Inject

/**
 * Drives the "Waiting for admin approval" screen. The screen is
 * reached after sign-in when the server reports the device is not
 * approved; it polls the device row every few seconds and transitions
 * to Home once the admin approves (or back to SignIn if the device
 * is blocked or the operator chooses to sign out).
 */
@HiltViewModel
class EnrolmentViewModel @Inject constructor(
    private val enrolmentRepository: EnrolmentRepository,
    private val sessionRepository: SessionRepository,
) : ViewModel() {

    data class UiState(
        val enrolment: DeviceEnrolment? = null,
        val checking: Boolean = true,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        startPolling()
    }

    fun refresh() {
        _state.update { it.copy(checking = true) }
        viewModelScope.launch {
            val now = enrolmentRepository.refreshStatus()
            _state.update { it.copy(enrolment = now, checking = false) }
        }
    }

    fun signOut(onSignedOut: () -> Unit) {
        viewModelScope.launch {
            sessionRepository.signOut()
            onSignedOut()
        }
    }

    private fun startPolling() {
        viewModelScope.launch {
            val terminal = enrolmentRepository.awaitApproval()
            _state.update { it.copy(enrolment = terminal, checking = false) }
        }
    }

    val isApproved: Boolean get() =
        _state.value.enrolment?.status == EnrolmentStatus.APPROVED
}
