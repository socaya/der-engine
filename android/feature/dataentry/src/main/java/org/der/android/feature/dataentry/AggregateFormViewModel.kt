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
import org.der.android.core.sync.AggregateRepository
import javax.inject.Inject

/**
 * Drives the aggregate form screen. Loads the dataset metadata the
 * screen needs to render inputs, holds the operator's draft values,
 * submits via [AggregateRepository] on save.
 */
@HiltViewModel
class AggregateFormViewModel @Inject constructor(
    private val repository: AggregateRepository,
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
    ) {
        val canSubmit: Boolean
            get() = !submitting && dataSet != null
                && orgUnit.isNotBlank() && period.isNotBlank()
                && values.values.any { it.isNotBlank() }
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching { repository.getDataSet(dataSetId) }
                .onSuccess { ds ->
                    _state.update { it.copy(loading = false, dataSet = ds) }
                }
                .onFailure { t ->
                    _state.update {
                        it.copy(loading = false, error = t.message ?: "Load failed")
                    }
                }
        }
    }

    fun onOrgUnit(v: String) = _state.update { it.copy(orgUnit = v) }
    fun onPeriod(v: String) = _state.update { it.copy(period = v) }
    fun onValue(dataElementId: String, v: String) = _state.update {
        it.copy(values = it.values + (dataElementId to v))
    }

    fun submit() {
        val s = _state.value
        if (!s.canSubmit) return
        val ds = s.dataSet ?: return
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
