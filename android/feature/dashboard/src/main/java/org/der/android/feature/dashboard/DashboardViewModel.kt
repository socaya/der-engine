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
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

/**
 * Rolls the dashboard signals into one StateFlow — edge
 * reachability, pending-capture count, recent work rows,
 * connected peer count, and a 7-day activity histogram built
 * from `sentAt` timestamps in the capture journal.
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val probe: EdgeHealthProbe,
    private val dao: CaptureJournalDao,
    private val mesh: PeerMesh,
    private val drain: AggregateDrainScheduler,
) : ViewModel() {

    data class Day(val label: String, val sentCount: Int)

    data class UiState(
        val edgeReachable: Boolean = false,
        val edgeLastError: String? = null,
        val pending: Int = 0,
        val peers: Int = 0,
        val recent: List<CapturePending> = emptyList(),
        val activity: List<Day> = emptyList(),
    )

    private val sevenDaysAgoMillis: Long
        get() {
            val zone = ZoneId.systemDefault()
            return LocalDate.now(zone).minusDays(6).atStartOfDay(zone)
                .toInstant().toEpochMilli()
        }

    val state: StateFlow<UiState> = combine(
        probe.state,
        dao.observeCountByStatus(CaptureJournalEntity.STATUS_PENDING),
        dao.observeRecent(),
        mesh.peers,
        dao.observeSentSince(sevenDaysAgoMillis),
    ) { arr ->
        val edge = arr[0] as EdgeHealthProbe.State
        @Suppress("UNCHECKED_CAST")
        UiState(
            edgeReachable = edge.reachable,
            edgeLastError = edge.lastError,
            pending = arr[1] as Int,
            peers = (arr[3] as List<PeerMesh.Peer>).size,
            recent = (arr[2] as List<CaptureJournalEntity>)
                .take(10)
                .map { it.toPending() },
            activity = bucketBySentDay(arr[4] as List<Long>),
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

    private fun CaptureJournalEntity.toPending(): CapturePending = CapturePending(
        id = id,
        resource = resource,
        summary = buildString {
            append(dataSet ?: resource)
            orgUnit?.let { ou -> append(" · $ou") }
            period?.let { p -> append(" · $p") }
            append(" · $status")
        },
        attempts = attempts,
        lastError = lastError,
        createdAt = createdAt,
    )

    private fun bucketBySentDay(sentAts: List<Long>): List<Day> {
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val labels = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
        val days = (6 downTo 0).map { back -> today.minusDays(back.toLong()) }
        val counts = IntArray(days.size)
        for (at in sentAts) {
            val d = Instant.ofEpochMilli(at).atZone(zone).toLocalDate()
            val idx = days.indexOf(d)
            if (idx >= 0) counts[idx]++
        }
        return days.mapIndexed { i, d ->
            Day(
                label = labels[(d.dayOfWeek.value - 1).coerceIn(0, 6)],
                sentCount = counts[i],
            )
        }
    }
}
