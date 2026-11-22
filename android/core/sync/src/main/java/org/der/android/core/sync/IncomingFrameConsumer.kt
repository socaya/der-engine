package org.der.android.core.sync

import dagger.Lazy
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
 * DPP/1 frames destined for this device.
 *
 * Two behaviours:
 *   1. **Nudge** — every frame addressed to this device emits a
 *      typed Nudge the UI can collect to flash a toast + refresh
 *      the queue without waiting for the next poll.
 *   2. **Auto-apply** (Phase 6.5+) — for `workflow:run-advance`
 *      frames addressed to this device, auto-POST the contribution
 *      via [WorkflowRepository.contribute]. The server is still
 *      authoritative — it rejects the call if we don't own the
 *      step — so auto-apply is safe even against a malicious peer.
 *      Dedupe is by `runId:stepId:payload` hash so a re-sent frame
 *      doesn't double-fire.
 *
 * The [WorkflowRepository] dependency is injected as [Lazy] to
 * break the cycle: WorkflowRepository → PeerMesh → mesh.send calls
 * back into DI; keeping it lazy means the consumer graph still
 * builds in the right order.
 */
@Singleton
class IncomingFrameConsumer @Inject constructor(
    private val mesh: PeerMesh,
    private val identity: DeviceIdentity,
    private val workflowRepository: Lazy<WorkflowRepository>,
) {
    data class Nudge(
        val resource: String,
        val action: String,
        val fromDevice: String,
        val runId: String?,
        val stepId: String?,
        val autoApplied: Boolean = false,
        val receivedAt: Long = System.currentTimeMillis(),
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _nudges = MutableSharedFlow<Nudge>(replay = 0, extraBufferCapacity = 32)
    val nudges: Flow<Nudge> = _nudges.asSharedFlow()

    private var runner: Job? = null

    // Dedupe set for auto-applied contributions. Keyed by
    // "runId:stepId:payloadHash" so a retransmit doesn't POST twice.
    private val appliedKeys = linkedSetOf<String>()
    private val appliedLock = Any()

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
        val target = frame.to ?: return true   // broadcast
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

        var autoApplied = false
        val payload = frame.payload
        if (resource == "workflow" && action == "run-advance"
            && runId != null && stepId != null && payload != null) {
            autoApplied = autoApply(runId, stepId, payload, frame.to)
        }

        _nudges.emit(
            Nudge(
                resource = resource,
                action = action,
                fromDevice = frame.from,
                runId = runId,
                stepId = stepId,
                autoApplied = autoApplied,
            ),
        )
    }

    private suspend fun autoApply(
        runId: String,
        stepId: String,
        payload: String,
        targetDevice: String?,
    ): Boolean {
        // Only auto-apply when the frame explicitly targets this
        // device. Broadcasts (`to == null`) land as nudges only —
        // we don't want to accidentally claim a step the sender
        // didn't pin to us.
        val selfId = identity.deviceId().toString()
        if (targetDevice != selfId) return false

        val key = "$runId:$stepId:${payload.hashCode()}"
        val isFresh = synchronized(appliedLock) {
            if (key in appliedKeys) false
            else {
                appliedKeys.add(key)
                if (appliedKeys.size > MAX_APPLIED_KEYS) {
                    appliedKeys.remove(appliedKeys.iterator().next())
                }
                true
            }
        }
        if (!isFresh) {
            Timber.i("auto-apply skipped (duplicate) key=%s", key)
            return false
        }

        val result = runCatching {
            workflowRepository.get().contribute(
                runId = runId,
                stepId = stepId,
                payloadJson = payload,
                nextOwnerDeviceId = null,
            )
        }
        result.onFailure { Timber.w(it, "auto-apply contribute failed") }
        val success = result.getOrNull()?.success == true
        Timber.i("auto-apply %s run=%s step=%s", if (success) "ok" else "nope", runId, stepId)
        return success
    }

    companion object {
        private const val MAX_APPLIED_KEYS = 256
    }
}
