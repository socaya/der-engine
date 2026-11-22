package org.der.android.feature.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.der.android.core.data.journal.CaptureJournalDao
import org.der.android.core.data.journal.CaptureJournalEntity
import org.der.android.core.domain.CapturePending
import org.der.android.core.p2p.PeerMesh
import org.der.android.core.sync.AggregateDrainScheduler
import org.der.android.core.sync.EdgeHealthProbe
import javax.inject.Inject

/**
 * Rolls the dashboard signals into one StateFlow — edge
 * reachability, pending-capture count, recent work rows and
 * connected peer count. Matches `client/src/screens/SyncStatus`,
 * `NetworkStatus`, `Dhis2Status`, `RecentWork` composed into one
 * surface.
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val probe: EdgeHealthProbe,
    private val dao: CaptureJournalDao,
    private val mesh: PeerMesh,
    private val drain: AggregateDrainScheduler,
) : ViewModel() {

    data class UiState(
        val edgeReachable: Boolean = false,
        val edgeLastError: String? = null,
        val pending: Int = 0,
        val peers: Int = 0,
        val recent: List<CapturePending> = emptyList(),
    )

    val state: StateFlow<UiState> = combine(
        probe.state,
        dao.observeCountByStatus(CaptureJournalEntity.STATUS_PENDING),
        dao.observeRecent(),
        mesh.peers,
    ) { edge, pending, recent, peers ->
        UiState(
            edgeReachable = edge.reachable,
            edgeLastError = edge.lastError,
            pending = pending,
            peers = peers.size,
            recent = recent.take(10).map {
                CapturePending(
                    id = it.id,
                    resource = it.resource,
                    summary = buildString {
                        append(it.dataSet ?: it.resource)
                        it.orgUnit?.let { ou -> append(" · $ou") }
                        it.period?.let { p -> append(" · $p") }
                        append(" · ${it.status}")
                    },
                    attempts = it.attempts,
                    lastError = it.lastError,
                    createdAt = it.createdAt,
                )
            },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), UiState())

    init { attach() }

    private fun attach() {
        probe.attach()
        viewModelScope.launch { mesh.start() }
    }

    override fun onCleared() {
        probe.detach()
    }

    fun drainNow() {
        drain.scheduleDrain()
    }
}
