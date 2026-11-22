package org.der.android.feature.workflow

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.domain.WorkflowQueueRow
import org.der.android.core.domain.WorkflowRun
import org.der.android.core.sync.WorkflowRepository
import javax.inject.Inject

/**
 * Workflow queue — the operator's current work. Mirrors the queue
 * ribbon from the web client's WorkflowActivity + WorkflowMonitoring
 * screens.
 */
@HiltViewModel
class WorkflowQueueViewModel @Inject constructor(
    private val repository: WorkflowRepository,
) : ViewModel() {

    data class UiState(
        val loading: Boolean = true,
        val rows: List<WorkflowQueueRow> = emptyList(),
        val error: String? = null,
        val allDevices: Boolean = false,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { repository.queue(allDevices = _state.value.allDevices) }
                .onSuccess { rows -> _state.update { it.copy(loading = false, rows = rows) } }
                .onFailure { t ->
                    _state.update { it.copy(loading = false, error = t.message ?: "Load failed") }
                }
        }
    }

    fun toggleAllDevices() {
        _state.update { it.copy(allDevices = !it.allDevices) }
        refresh()
    }
}

/**
 * Run detail + step contribution. Phase 6 keeps the payload a free-
 * form string — Phase 7 structures it against the server's step
 * schema and adds validation. The screen accepts a payload, posts
 * via the repository (which HTTP-calls the edge + broadcasts a
 * DPP/1 workflow-advance frame), and routes back on success.
 */
@HiltViewModel
class WorkflowRunViewModel @Inject constructor(
    private val repository: WorkflowRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    private val runId: String =
        checkNotNull(savedState.get<String>(KEY_RUN_ID)) { "runId arg missing" }
    private val stepId: String =
        checkNotNull(savedState.get<String>(KEY_STEP_ID)) { "stepId arg missing" }

    data class UiState(
        val loading: Boolean = true,
        val run: WorkflowRun? = null,
        val payload: String = "",
        val nextOwnerDeviceId: String = "",
        val submitting: Boolean = false,
        val error: String? = null,
        val completed: Boolean = false,
    ) {
        val canSubmit: Boolean
            get() = !submitting && run != null && payload.isNotBlank()
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching { repository.getRun(runId) }
                .onSuccess { r -> _state.update { it.copy(loading = false, run = r) } }
                .onFailure { t -> _state.update { it.copy(loading = false, error = t.message) } }
        }
    }

    fun onPayload(v: String) = _state.update { it.copy(payload = v, error = null) }
    fun onNextOwner(v: String) = _state.update { it.copy(nextOwnerDeviceId = v) }

    fun contribute() {
        val s = _state.value
        if (!s.canSubmit) return
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            val result = repository.contribute(
                runId = runId,
                stepId = stepId,
                payloadJson = s.payload.trim(),
                nextOwnerDeviceId = s.nextOwnerDeviceId.trim().takeIf { it.isNotBlank() },
            )
            _state.update {
                if (result.success) {
                    it.copy(submitting = false, completed = result.completed)
                } else {
                    it.copy(
                        submitting = false,
                        error = result.errorMessage ?: "HTTP ${result.httpCode}",
                    )
                }
            }
        }
    }

    companion object {
        const val KEY_RUN_ID = "runId"
        const val KEY_STEP_ID = "stepId"
    }
}
