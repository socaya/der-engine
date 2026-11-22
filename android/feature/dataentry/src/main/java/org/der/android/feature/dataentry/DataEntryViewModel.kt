package org.der.android.feature.dataentry

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.der.android.core.domain.DataSetSummary
import org.der.android.core.sync.AggregateRepository
import javax.inject.Inject

/**
 * Dataset picker for DER Data Entry. Lists the facility's aggregate
 * datasets — same shape as the web client's AggregateDatasetPicker.
 * Server reachability failures leave the list empty; the UI shows a
 * retry affordance.
 */
@HiltViewModel
class DataEntryViewModel @Inject constructor(
    private val repository: AggregateRepository,
) : ViewModel() {

    data class UiState(
        val loading: Boolean = true,
        val dataSets: List<DataSetSummary> = emptyList(),
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { repository.listDataSets() }
                .onSuccess { list ->
                    _state.update { it.copy(loading = false, dataSets = list) }
                }
                .onFailure { t ->
                    _state.update {
                        it.copy(loading = false, error = t.message ?: "Load failed")
                    }
                }
        }
    }
}
