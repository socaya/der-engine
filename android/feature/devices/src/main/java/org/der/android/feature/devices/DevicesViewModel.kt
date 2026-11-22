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
import org.der.android.core.domain.EdgeDevice
import org.der.android.core.domain.EnrolmentStatus
import javax.inject.Inject

/**
 * Admin-visible device fleet. Mirrors the queue the web
 * admin-UI serves on Devices → Enrolment.
 */
@HiltViewModel
class DevicesViewModel @Inject constructor(
    private val repository: EnrolmentRepository,
) : ViewModel() {

    enum class Filter { ALL, PENDING, APPROVED, BLOCKED }

    data class UiState(
        val loading: Boolean = true,
        val devices: List<EdgeDevice> = emptyList(),
        val error: String? = null,
        val filter: Filter = Filter.PENDING,
        val busy: String? = null,
        val toast: String? = null,
    ) {
        val visible: List<EdgeDevice>
            get() = when (filter) {
                Filter.ALL -> devices
                Filter.PENDING -> devices.filter { it.status == EnrolmentStatus.PENDING }
                Filter.APPROVED -> devices.filter { it.status == EnrolmentStatus.APPROVED }
                Filter.BLOCKED -> devices.filter { it.status == EnrolmentStatus.BLOCKED }
            }
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { repository.listDevices() }
                .onSuccess { list -> _state.update { it.copy(loading = false, devices = list) } }
                .onFailure { t ->
                    _state.update { it.copy(loading = false, error = t.message ?: "Load failed") }
                }
        }
    }

    fun onFilter(f: Filter) = _state.update { it.copy(filter = f) }
    fun clearToast() = _state.update { it.copy(toast = null) }

    fun approve(d: EdgeDevice) = act(d.deviceId, "Approved") { repository.approveDevice(d.deviceId) }
    fun suspend(d: EdgeDevice) = act(d.deviceId, "Suspended") { repository.suspendDevice(d.deviceId) }
    fun revoke(d: EdgeDevice) = act(d.deviceId, "Revoked") { repository.revokeDevice(d.deviceId) }

    private fun act(id: String, label: String, block: suspend () -> EdgeDevice?) {
        if (_state.value.busy != null) return
        _state.update { it.copy(busy = id) }
        viewModelScope.launch {
            val result = runCatching { block() }
            _state.update {
                it.copy(
                    busy = null,
                    toast = if (result.isSuccess && result.getOrNull() != null) label
                        else result.exceptionOrNull()?.message ?: "Action failed",
                )
            }
            refresh()
        }
    }
}
