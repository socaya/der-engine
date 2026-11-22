package org.der.android.feature.dataentry

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.domain.DataSet
import org.der.android.core.rules.ValidationEngine
import org.der.android.core.rules.ValidationResult
import org.der.android.core.rules.ValidationRule
import org.der.android.core.sync.AggregateRepository
import org.der.android.core.sync.RulesRepository
import javax.inject.Inject

/**
 * Drives the aggregate form screen. Loads the dataset metadata the
 * screen needs to render inputs, holds the operator's draft values,
 * submits via [AggregateRepository] on save. Runs DHIS2 validation
 * rules on submit; HIGH-importance violations block the save,
 * MEDIUM/LOW are shown as warnings the operator can override.
 */
@HiltViewModel
class AggregateFormViewModel @Inject constructor(
    private val repository: AggregateRepository,
    private val rulesRepository: RulesRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    private val dataSetId: String =
        checkNotNull(savedState.get<String>(KEY_DATA_SET_ID)) {
            "id arg missing"
        }

    data class UiState(
        val loading: Boolean = true,
        val dataSet: DataSet? = null,
        val error: String? = null,
        val orgUnit: String = "",
        val period: String = "",
        val values: Map<String, String> = emptyMap(),
        val submitting: Boolean = false,
        val savedId: Long? = null,
        val validationResults: List<ValidationResult> = emptyList(),
        val overrideWarnings: Boolean = false,
    ) {
        val highErrors: List<ValidationResult>
            get() = validationResults.filter { it.importance == ValidationRule.Importance.HIGH }

        val mediumOrLow: List<ValidationResult>
            get() = validationResults.filter { it.importance != ValidationRule.Importance.HIGH }

        val canSubmit: Boolean
            get() = !submitting && dataSet != null
                && orgUnit.isNotBlank() && period.isNotBlank()
                && values.values.any { it.isNotBlank() }
                && highErrors.isEmpty()
                && (mediumOrLow.isEmpty() || overrideWarnings)
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var validator: ValidationEngine = ValidationEngine(emptyList())

    init {
        viewModelScope.launch {
            val ds = runCatching { repository.getDataSet(dataSetId) }.getOrNull()
            validator = runCatching { rulesRepository.validationEngine(dataSetId) }
                .getOrElse { ValidationEngine(emptyList()) }
            _state.update { it.copy(loading = false, dataSet = ds) }
        }
    }

    fun onOrgUnit(v: String) = _state.update { it.copy(orgUnit = v) }
    fun onPeriod(v: String) = _state.update { it.copy(period = v) }
    fun onValue(dataElementId: String, v: String) = _state.update {
        // Any edit clears the stale validation + override state.
        it.copy(
            values = it.values + (dataElementId to v),
            validationResults = emptyList(),
            overrideWarnings = false,
        )
    }
    fun toggleOverride() = _state.update { it.copy(overrideWarnings = !it.overrideWarnings) }

    fun submit() {
        val s = _state.value
        val ds = s.dataSet ?: return
        val results = validator.validate(s.values)
        if (results.isNotEmpty()) {
            _state.update { it.copy(validationResults = results) }
            if (results.any { it.importance == ValidationRule.Importance.HIGH }) return
            if (!_state.value.overrideWarnings) return
        }
        if (!_state.value.canSubmit) return
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            runCatching {
                repository.enqueueSubmission(
                    dataSet = ds.id,
                    orgUnit = s.orgUnit.trim(),
                    period = s.period.trim(),
                    values = s.values,
                )
            }.onSuccess { id ->
                _state.update { it.copy(submitting = false, savedId = id) }
            }.onFailure { t ->
                _state.update {
                    it.copy(submitting = false, error = t.message ?: "Save failed")
                }
            }
        }
    }

    companion object {
        const val KEY_DATA_SET_ID = "id"
    }
}
