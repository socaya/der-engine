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
import org.der.android.core.domain.Contribution
import org.der.android.core.domain.WorkflowRun
import org.der.android.core.sync.WorkflowRepository
import javax.inject.Inject

/**
 * Timeline of per-step contributions for one capture-workflow run.
 * Shows who submitted each step + when + from which device, so
 * supervisors can audit the baton as it moved between service
 * points.
 */
@HiltViewModel
class WorkflowContributionsViewModel @Inject constructor(
    private val repository: WorkflowRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    private val runId: String =
        checkNotNull(savedState.get<String>(KEY_RUN_ID)) { "runId arg missing" }

    data class UiState(
        val loading: Boolean = true,
        val run: WorkflowRun? = null,
        val contributions: List<Contribution> = emptyList(),
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            val run = runCatching { repository.getRun(runId) }.getOrNull()
            val contributions = runCatching { repository.contributions(runId) }
                .getOrElse { emptyList() }
            _state.update {
                it.copy(loading = false, run = run, contributions = contributions)
            }
        }
    }

    companion object { const val KEY_RUN_ID = "runId" }
}
