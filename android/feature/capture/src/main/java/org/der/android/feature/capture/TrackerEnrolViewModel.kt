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
import org.der.android.core.domain.EnrolResult
import org.der.android.core.domain.Program
import org.der.android.core.rules.RuleEngine
import org.der.android.core.rules.RuleEvaluation
import org.der.android.core.sync.CaptureRepository
import org.der.android.core.sync.RulesRepository
import javax.inject.Inject

/**
 * Drives the tracker-enrol screen: attribute capture for a brand-new
 * TEI followed by a first enrolment into the program. Rule engine
 * fires on every attribute change so HIDE/MANDATORY/ASSIGN behave
 * the same way as in EventNew.
 */
@HiltViewModel
class TrackerEnrolViewModel @Inject constructor(
    private val repository: CaptureRepository,
    private val rulesRepository: RulesRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    private val programId: String =
        checkNotNull(savedState.get<String>(KEY_PROGRAM_ID)) { "programId arg missing" }

    data class UiState(
        val loading: Boolean = true,
        val program: Program? = null,
        val orgUnit: String = "",
        val attributes: Map<String, String> = emptyMap(),
        val submitting: Boolean = false,
        val error: String? = null,
        val success: Success? = null,
        val evaluation: RuleEvaluation = RuleEvaluation(emptyList()),
    ) {
        data class Success(val teiUid: String, val enrollmentUid: String)

        val visibleAttributes get() = program?.attributes
            .orEmpty()
            .filter { it.id !in evaluation.hiddenFields }

        val missingMandatory: Set<String>
            get() = evaluation.mandatoryFields.filter {
                attributes[it].isNullOrBlank()
            }.toSet()

        val canSubmit: Boolean
            get() = !submitting && program != null && orgUnit.isNotBlank()
                && attributes.values.any { it.isNotBlank() }
                && !evaluation.hasBlockingErrors
                && missingMandatory.isEmpty()
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var engine: RuleEngine? = null

    init {
        viewModelScope.launch {
            val program = runCatching { repository.getProgram(programId) }.getOrNull()
            engine = runCatching { rulesRepository.programEngine(programId) }.getOrNull()
            _state.update { it.copy(loading = false, program = program) }
            reevaluate()
        }
    }

    fun onOrgUnit(v: String) = _state.update { it.copy(orgUnit = v) }
    fun onAttribute(attr: String, v: String) {
        _state.update { it.copy(attributes = it.attributes + (attr to v)) }
        reevaluate()
    }

    private fun reevaluate() {
        val ev = engine ?: return
        val attrs = _state.value.attributes
        val evaluation = ev.evaluate(programStageId = null, values = attrs)
        val assigned = evaluation.assignments
            .filterValues { it != null }
            .mapValues { it.value.orEmpty() }
        val newAttrs = if (assigned.isEmpty()) attrs else attrs + assigned
        _state.update { it.copy(attributes = newAttrs, evaluation = evaluation) }
    }

    fun enrol() {
        val s = _state.value
        val program = s.program ?: return
        if (!s.canSubmit) return
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            val result = repository.enrolTrackedEntity(
                program = program,
                orgUnit = s.orgUnit.trim(),
                attributes = s.attributes,
            )
            when (result) {
                is EnrolResult.Success -> _state.update {
                    it.copy(
                        submitting = false,
                        success = UiState.Success(result.teiUid, result.enrollmentUid),
                    )
                }
                is EnrolResult.AttributeCollision -> _state.update {
                    it.copy(
                        submitting = false,
                        error = "An existing patient already uses this ${result.attributeUid} value.",
                    )
                }
                is EnrolResult.ActiveClash -> _state.update {
                    it.copy(
                        submitting = false,
                        error = "This patient is already enrolled in this programme.",
                    )
                }
                is EnrolResult.ServerError -> _state.update {
                    it.copy(submitting = false, error = result.message ?: "Server rejected the enrolment.")
                }
                is EnrolResult.NetworkError -> _state.update {
                    it.copy(submitting = false, error = result.message ?: "Can't reach the edge.")
                }
            }
        }
    }

    companion object { const val KEY_PROGRAM_ID = "programId" }
}
