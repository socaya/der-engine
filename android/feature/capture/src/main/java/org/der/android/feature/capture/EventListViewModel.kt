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

    enum class StatusFilter { ALL, ACTIVE, SCHEDULE, COMPLETED }

    data class UiState(
        val loading: Boolean = true,
        val program: Program? = null,
        val orgUnit: String = "",
        val events: List<EventRow> = emptyList(),
        val filter: StatusFilter = StatusFilter.ALL,
        val completing: String? = null,
        val error: String? = null,
    ) {
        val visibleEvents: List<EventRow>
            get() = when (filter) {
                StatusFilter.ALL -> events
                StatusFilter.ACTIVE ->
                    events.filter { (it.status ?: "").equals("ACTIVE", true) }
                StatusFilter.SCHEDULE ->
                    events.filter { (it.status ?: "").equals("SCHEDULE", true) }
                StatusFilter.COMPLETED ->
                    events.filter { (it.status ?: "").equals("COMPLETED", true) }
            }
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val program = runCatching { repository.getProgram(programId) }.getOrNull()
            _state.update { it.copy(loading = false, program = program) }
        }
    }

    fun onOrgUnit(v: String) = _state.update { it.copy(orgUnit = v) }
    fun onFilter(f: StatusFilter) = _state.update { it.copy(filter = f) }

    /**
     * Complete a scheduled event in one tap. Re-POSTs the event
     * with `status = COMPLETED` to the same tracker endpoint;
     * fallback is that WorkManager retries like any other capture.
     */
    fun complete(ev: EventRow) {
        if (_state.value.completing != null) return
        _state.update { it.copy(completing = ev.event) }
        viewModelScope.launch {
            val full = runCatching { repository.getEvent(ev.event) }.getOrNull()
            if (full == null) {
                _state.update { it.copy(completing = null, error = "Can't load event ${ev.event}") }
                return@launch
            }
            runCatching {
                repository.enqueueEventUpdate(
                    eventUid = full.eventUid,
                    programUid = full.programUid ?: programId,
                    programStageUid = full.programStageUid.orEmpty(),
                    orgUnitUid = full.orgUnitUid ?: _state.value.orgUnit.trim(),
                    occurredDate = full.occurredDate
                        ?: java.time.LocalDate.now().toString(),
                    status = "COMPLETED",
                    values = full.dataValues,
                    enrollmentUid = full.enrollmentUid,
                )
            }
            _state.update { it.copy(completing = null) }
            refresh()
        }
    }

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
