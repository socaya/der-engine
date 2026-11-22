package org.der.android.feature.capture

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.domain.EventRow
import org.der.android.core.domain.Program
import org.der.android.core.sync.CaptureRepository
import javax.inject.Inject

/**
 * Lists existing events for a program on the operator's chosen OU.
 * Phase scope: read-only list + a FAB that routes to EventNew — edit
 * of existing events follows the same pattern as new entry, once the
 * server-side single-event GET shape stabilises.
 */
@HiltViewModel
class EventListViewModel @Inject constructor(
    private val repository: CaptureRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    val programId: String =
        checkNotNull(savedState.get<String>(KEY_PROGRAM_ID)) { "programId arg missing" }

    data class UiState(
        val loading: Boolean = true,
        val program: Program? = null,
        val orgUnit: String = "",
        val events: List<EventRow> = emptyList(),
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val program = runCatching { repository.getProgram(programId) }.getOrNull()
            _state.update { it.copy(loading = false, program = program) }
        }
    }

    fun onOrgUnit(v: String) = _state.update { it.copy(orgUnit = v) }

    fun refresh() {
        val ou = _state.value.orgUnit.trim()
        if (ou.isEmpty()) return
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { repository.listEvents(programId, ou) }
                .onSuccess { list -> _state.update { it.copy(loading = false, events = list) } }
                .onFailure { t ->
                    _state.update { it.copy(loading = false, error = t.message ?: "Load failed") }
                }
        }
    }

    companion object { const val KEY_PROGRAM_ID = "programId" }
}
