package org.der.android.ui.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.der.android.core.domain.CapturePending
import org.der.android.core.sync.AggregateDrainScheduler
import org.der.android.core.sync.AggregateRepository
import javax.inject.Inject

/**
 * Backs the Sync tile — a live view of the local capture journal
 * plus per-row Retry / Discard and a global Drain now.
 */
@HiltViewModel
class SyncViewModel @Inject constructor(
    private val repository: AggregateRepository,
    private val drain: AggregateDrainScheduler,
) : ViewModel() {

    val rows: StateFlow<List<CapturePending>> = repository.observePending()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun drainNow() {
        drain.scheduleDrain()
    }

    fun retry(id: Long) {
        viewModelScope.launch { repository.retry(id) }
    }

    fun discard(id: Long) {
        viewModelScope.launch { repository.discard(id) }
    }
}
