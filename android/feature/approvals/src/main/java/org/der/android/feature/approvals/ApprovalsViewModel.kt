package org.der.android.feature.approvals

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.domain.ApprovalOutcome
import org.der.android.core.domain.PendingApproval
import org.der.android.core.domain.ReferralEntry
import org.der.android.core.domain.ReferralOutcome
import org.der.android.core.sync.ApprovalsRepository
import javax.inject.Inject

/**
 * Supervisor dashboard — pending operation approvals + referral
 * inbox in one surface. Keeps parity with the web client's
 * SubmittedReview + ReferralInbox screens.
 */
@HiltViewModel
class ApprovalsViewModel @Inject constructor(
    private val repository: ApprovalsRepository,
) : ViewModel() {

    data class UiState(
        val loading: Boolean = true,
        val approvals: List<PendingApproval> = emptyList(),
        val referrals: List<ReferralEntry> = emptyList(),
        val error: String? = null,
        val busyOp: String? = null,
        val toast: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching {
                val approvals = repository.pendingApprovals()
                val referrals = repository.referralInbox()
                approvals to referrals
            }.onSuccess { (a, r) ->
                _state.update {
                    it.copy(loading = false, approvals = a, referrals = r)
                }
            }.onFailure { t ->
                _state.update { it.copy(loading = false, error = t.message ?: "Load failed") }
            }
        }
    }

    fun approve(opId: String) = act(opId) { repository.approve(opId).friendly("Approved") }
    fun reject(opId: String, reason: String) = act(opId) {
        repository.reject(opId, reason).friendly("Rejected")
    }
    fun acceptReferral(inboxId: String) = act(inboxId) {
        repository.acceptReferral(inboxId).friendly("Referral accepted")
    }
    fun dismissReferral(inboxId: String) = act(inboxId) {
        repository.dismissReferral(inboxId).friendly("Referral dismissed")
    }

    fun clearToast() = _state.update { it.copy(toast = null) }

    private fun act(id: String, block: suspend () -> String) {
        if (_state.value.busyOp != null) return
        _state.update { it.copy(busyOp = id) }
        viewModelScope.launch {
            val toast = runCatching { block() }.getOrElse { it.message ?: "Failed" }
            _state.update { it.copy(busyOp = null, toast = toast) }
            refresh()
        }
    }

    private fun ApprovalOutcome.friendly(successMsg: String): String = when (this) {
        ApprovalOutcome.APPROVED, ApprovalOutcome.REJECTED -> successMsg
        ApprovalOutcome.NOT_FOUND -> "Operation no longer exists"
        ApprovalOutcome.NOT_REQUIRED -> "No approval needed here"
        ApprovalOutcome.ALREADY_DECIDED -> "Already decided by another supervisor"
        ApprovalOutcome.UNKNOWN -> "Unexpected response"
    }

    private fun ReferralOutcome.friendly(successMsg: String): String = when (this) {
        ReferralOutcome.ACCEPTED, ReferralOutcome.DISMISSED -> successMsg
        ReferralOutcome.INGEST_UNAVAILABLE ->
            "Referral intake service is offline on this edge. Try again later."
        ReferralOutcome.INGEST_FAILED ->
            "Intake threw — referral kept pending for retry."
        ReferralOutcome.INGEST_REJECTED ->
            "Intake rejected the payload — kept pending."
        ReferralOutcome.NOT_FOUND -> "Referral no longer exists"
        ReferralOutcome.UNKNOWN -> "Unexpected response"
    }
}
