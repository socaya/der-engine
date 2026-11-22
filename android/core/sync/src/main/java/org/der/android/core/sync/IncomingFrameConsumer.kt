package org.der.android.core.sync

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import org.der.android.core.data.device.DeviceIdentity
import org.der.android.core.p2p.DppFrame
import org.der.android.core.p2p.PeerMesh
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Subscribes to the peer mesh's inbound frame stream and reacts to
 * DPP/1 frames destined for this device. Phase 6.5: focus on
 * `workflow:run-advance` — when a handoff frame lands addressed to
 * our device UUID, emit a nudge the Workflow screen uses to refresh
 * its queue without waiting on the next poll.
 *
 * Deliberately narrow: the authoritative state still lives on the
 * edge server. The mesh frame just tells the next service point
 * "the baton is ready" seconds before the server-side poll would.
 */
@Singleton
class IncomingFrameConsumer @Inject constructor(
    private val mesh: PeerMesh,
    private val identity: DeviceIdentity,
) {
    data class Nudge(
        val resource: String,
        val action: String,
        val fromDevice: String,
        val runId: String?,
        val stepId: String?,
        val receivedAt: Long = System.currentTimeMillis(),
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _nudges = MutableSharedFlow<Nudge>(replay = 0, extraBufferCapacity = 32)
    /** Nudges the UI can collect to flash a toast + trigger refresh. */
    val nudges: Flow<Nudge> = _nudges.asSharedFlow()

    private var runner: Job? = null

    /**
     * Idempotent — safe to call from Application.onCreate, a route
     * composable, or an onStart hook. The subscription is torn down
     * only when the host scope is cancelled (ie. process death).
     */
    fun install() {
        if (runner != null) return
        runner = scope.launch {
            val selfId = identity.deviceId().toString()
            mesh.incoming
                .filter { addressedToUs(it, selfId) }
                .onEach { frame -> handle(frame) }
                .collect()
        }
    }

    private fun addressedToUs(frame: DppFrame, selfId: String): Boolean {
        val target = frame.to ?: return true   // broadcast — consider ourselves eligible
        return target == selfId
    }

    private suspend fun handle(frame: DppFrame) {
        val resource = frame.resource
        val action = frame.action
        val (runId, stepId) = runCatching {
            val parts = frame.id.split(":", limit = 2)
            parts.getOrNull(0) to parts.getOrNull(1)
        }.getOrElse { null to null }
        Timber.i(
            "DPP/1 inbound: %s:%s from=%s run=%s step=%s",
            resource, action, frame.from, runId, stepId,
        )
        _nudges.emit(
            Nudge(
                resource = resource,
                action = action,
                fromDevice = frame.from,
                runId = runId,
                stepId = stepId,
            ),
        )
    }
}

