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
import org.der.android.core.domain.Program
import org.der.android.core.domain.ProgramSummary
import org.der.android.core.domain.TrackedEntity
import org.der.android.core.rules.RuleEngine
import org.der.android.core.rules.RuleEvaluation
import org.der.android.core.sync.CaptureRepository
import org.der.android.core.sync.RulesRepository
import javax.inject.Inject

/**
 * Program picker — matches client/src/screens/ProgramPicker.tsx. One
 * list, both tracker + event programs; the screen branches to either
 * TrackerSearch or EventNew based on the program type.
 */
@HiltViewModel
class ProgramPickerViewModel @Inject constructor(
    private val repository: CaptureRepository,
) : ViewModel() {

    data class UiState(
        val loading: Boolean = true,
        val programs: List<ProgramSummary> = emptyList(),
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { repository.listPrograms() }
                .onSuccess { list ->
                    _state.update { it.copy(loading = false, programs = list) }
                }
                .onFailure { t ->
                    _state.update { it.copy(loading = false, error = t.message ?: "Load failed") }
                }
        }
    }
}

/**
 * Tracker search — matches client/src/screens/TrackerSearch.tsx.
 * Phase 5 is read-only: list TEIs for a program + OU. Enrol + stage
 * new land with the rule engine phase.
 */
@HiltViewModel
class TrackerSearchViewModel @Inject constructor(
    private val repository: CaptureRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    private val programId: String =
        checkNotNull(savedState.get<String>(KEY_PROGRAM_ID)) { "programId arg missing" }

    data class UiState(
        val loading: Boolean = false,
        val program: Program? = null,
        val orgUnit: String = "",
        val entities: List<TrackedEntity> = emptyList(),
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState(loading = true))
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching { repository.getProgram(programId) }
                .onSuccess { p -> _state.update { it.copy(loading = false, program = p) } }
                .onFailure { t -> _state.update { it.copy(loading = false, error = t.message) } }
        }
    }

    fun onOrgUnit(v: String) = _state.update { it.copy(orgUnit = v) }

    fun search() {
        val ou = _state.value.orgUnit.trim()
        if (ou.isEmpty()) return
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { repository.searchTrackedEntities(programId, ou) }
                .onSuccess { list ->
                    _state.update { it.copy(loading = false, entities = list) }
                }
                .onFailure { t ->
                    _state.update { it.copy(loading = false, error = t.message ?: "Search failed") }
                }
        }
    }

    companion object { const val KEY_PROGRAM_ID = "programId" }
}

/**
 * Event capture for WITHOUT_REGISTRATION programs — matches
 * client/src/screens/EventNew.tsx. One page: pick stage, enter
 * orgUnit + date + dataElement values, enqueue.
 */
@HiltViewModel
class EventNewViewModel @Inject constructor(
    private val repository: CaptureRepository,
    private val rulesRepository: RulesRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    private val programId: String =
        checkNotNull(savedState.get<String>(KEY_PROGRAM_ID)) { "programId arg missing" }

    /** Set when the screen was reached in edit mode. The ID in the
     *  journal entry will be this one so the server upserts in
     *  place rather than creating a new row. */
    private val eventUidArg: String? =
        savedState.get<String?>(KEY_EVENT_UID)?.takeIf { it.isNotBlank() }
    private var existingEnrollmentUid: String? = null
    val isEditing: Boolean get() = eventUidArg != null

    data class UiState(
        val loading: Boolean = true,
        val program: Program? = null,
        val stageId: String? = null,
        val orgUnit: String = "",
        val occurredDate: String = "",
        val values: Map<String, String> = emptyMap(),
        val submitting: Boolean = false,
        val error: String? = null,
        val savedId: Long? = null,
        val evaluation: RuleEvaluation = RuleEvaluation(emptyList()),
    ) {
        val currentStage get() = program?.stages?.firstOrNull { it.id == stageId }
            ?: program?.stages?.firstOrNull()

        /** Elements the operator should see: stage data elements
         *  minus anything the rule engine has hidden. */
        val visibleDataElements get() =
            currentStage?.dataElements.orEmpty().filter { it.id !in evaluation.hiddenFields }

        val filledMandatory: Set<String>
            get() = evaluation.mandatoryFields.filter {
                !values[it].isNullOrBlank()
            }.toSet()

        val missingMandatory: Set<String>
            get() = evaluation.mandatoryFields - filledMandatory

        val canSubmit: Boolean
            get() = !submitting && program != null && currentStage != null
                && orgUnit.isNotBlank() && occurredDate.isNotBlank()
                && values.values.any { it.isNotBlank() }
                && !evaluation.hasBlockingErrors
                && missingMandatory.isEmpty()
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var engine: RuleEngine? = null

    init {
        viewModelScope.launch {
            val program = runCatching { repository.getProgram(programId) }
                .getOrElse { t ->
                    _state.update { it.copy(loading = false, error = t.message) }
                    return@launch
                }
            val built = runCatching { rulesRepository.programEngine(programId) }.getOrNull()
            engine = built

            // Pre-fill from the existing event when the screen was
            // opened in edit mode.
            val existing = eventUidArg?.let {
                runCatching { repository.getEvent(it) }.getOrNull()
            }
            existingEnrollmentUid = existing?.enrollmentUid
            val initialStageId = existing?.programStageUid
                ?: program?.stages?.firstOrNull()?.id
            val initialValues = existing?.dataValues ?: emptyMap()

            _state.update {
                it.copy(
                    loading = false,
                    program = program,
                    stageId = initialStageId,
                    orgUnit = existing?.orgUnitUid.orEmpty(),
                    occurredDate = existing?.occurredDate?.take(10).orEmpty(),
                    values = initialValues,
                )
            }
            reevaluate()
        }
    }

    fun onOrgUnit(v: String) = _state.update { it.copy(orgUnit = v) }
    fun onOccurredDate(v: String) = _state.update { it.copy(occurredDate = v) }
    fun onStage(id: String) {
        _state.update { it.copy(stageId = id) }
        reevaluate()
    }
    fun onValue(dataElement: String, v: String) {
        _state.update { it.copy(values = it.values + (dataElement to v)) }
        reevaluate()
    }

    private fun reevaluate() {
        val ev = engine ?: return
        val stageId = _state.value.stageId
        val values = _state.value.values
        val evaluation = ev.evaluate(stageId, values)
        // Apply ASSIGN results so they feed back into the next pass.
        val assigned = evaluation.assignments
            .filterValues { it != null }
            .mapValues { it.value.orEmpty() }
        val newValues = if (assigned.isEmpty()) values else values + assigned
        _state.update { it.copy(values = newValues, evaluation = evaluation) }
    }

    fun submit() {
        val s = _state.value
        val stage = s.currentStage ?: return
        val program = s.program ?: return
        if (!s.canSubmit) return
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            runCatching {
                val uid = eventUidArg
                if (uid != null) {
                    repository.enqueueEventUpdate(
                        eventUid = uid,
                        programUid = program.id,
                        programStageUid = stage.id,
                        orgUnitUid = s.orgUnit.trim(),
                        occurredDate = s.occurredDate.trim(),
                        status = "ACTIVE",
                        values = s.values,
                        enrollmentUid = existingEnrollmentUid,
                    )
                } else {
                    repository.enqueueEvent(
                        programUid = program.id,
                        programStageUid = stage.id,
                        orgUnitUid = s.orgUnit.trim(),
                        occurredDate = s.occurredDate.trim(),
                        values = s.values,
                    )
                }
            }.onSuccess { id -> _state.update { it.copy(submitting = false, savedId = id) } }
             .onFailure { t ->
                 _state.update { it.copy(submitting = false, error = t.message ?: "Save failed") }
             }
        }
    }

    companion object {
        const val KEY_PROGRAM_ID = "programId"
        const val KEY_EVENT_UID = "eventUid"
    }
}
