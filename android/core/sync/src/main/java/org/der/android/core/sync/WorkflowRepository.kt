package org.der.android.core.sync

import kotlinx.serialization.json.Json
import org.der.android.core.data.device.DeviceIdentity
import org.der.android.core.data.network.ContributeStepRequestDto
import org.der.android.core.data.network.DerApi
import org.der.android.core.domain.Readiness
import org.der.android.core.domain.WorkflowQueueRow
import org.der.android.core.domain.WorkflowRun
import org.der.android.core.p2p.DppFrame
import org.der.android.core.p2p.DppFrameType
import org.der.android.core.p2p.PeerMesh
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Drives DER's distributed workflow on the Android client:
 *   - [queue] — operator's current work queue, scoped to the device
 *     by default
 *   - [contribute] — POST a step contribution to the edge
 *   - [broadcastAdvance] — emit a DPP/1 workflow-advance frame to the
 *     peer mesh so a downstream service point picks up the next step
 *     directly over WebRTC when the edge is unreachable
 *
 * The distributed-workflow mandate (ADR-0041 §6, ADR-0038) requires
 * both the server-mediated path and the mesh-mediated path to work;
 * [contribute] runs both.
 */
@Singleton
class WorkflowRepository @Inject constructor(
    private val api: DerApi,
    private val identity: DeviceIdentity,
    private val mesh: PeerMesh,
    private val json: Json,
) {

    suspend fun queue(allDevices: Boolean = false): List<WorkflowQueueRow> {
        val deviceId = identity.deviceId().toString()
        val response = api.workflowQueue(
            deviceId = if (allDevices) null else deviceId,
            allDevices = allDevices,
        )
        val body = response.body() ?: return emptyList()
        return body.rows.map {
            WorkflowQueueRow(
                runId = it.runId,
                workflowId = it.workflowId,
                workflowName = it.workflowName ?: it.workflowId,
                businessKey = it.businessKey,
                stepId = it.stepId,
                stepOrdinal = it.stepOrdinal,
                stepName = it.stepName ?: "Step ${it.stepOrdinal}",
                ownerRole = it.ownerRole,
                ownerDeviceId = it.ownerDeviceId,
                readiness = Readiness.parse(it.readiness),
                runCreatedAt = it.runCreatedAt,
                runUpdatedAt = it.runUpdatedAt,
                validationErrorCount = it.validationErrorCount,
            )
        }
    }

    suspend fun getRun(runId: String): WorkflowRun? {
        val response = api.getWorkflowRun(runId)
        val body = response.body() ?: return null
        return WorkflowRun(
            runId = body.runId,
            workflowId = body.workflowId,
            businessKey = body.businessKey,
            state = body.state,
            createdAt = body.createdAt,
            updatedAt = body.updatedAt,
            submissionError = body.submissionError,
        )
    }

    suspend fun contributions(runId: String): List<org.der.android.core.domain.Contribution> {
        val response = api.listContributions(runId)
        val body = response.body() ?: return emptyList()
        return body.contributions.map {
            org.der.android.core.domain.Contribution(
                contributionId = it.contributionId,
                runId = it.runId,
                stepId = it.stepId,
                submittedBy = it.submittedBy,
                submittedDeviceId = it.submittedDeviceId,
                submittedAt = it.submittedAt,
            )
        }
    }

    suspend fun catalogue(): List<org.der.android.core.domain.WorkflowSummary> {
        val response = api.listWorkflows()
        val body = response.body() ?: return emptyList()
        return body.workflows
            .filter { it.enabled != false }
            .map {
                org.der.android.core.domain.WorkflowSummary(
                    workflowId = it.workflowId,
                    displayName = it.displayName ?: it.workflowId,
                    enabled = it.enabled != false,
                )
            }
    }

    data class OpenRunResult(
        val run: WorkflowRun?,
        val error: String?,
    )

    suspend fun openRun(workflowId: String, businessKey: String): OpenRunResult {
        val response = api.openWorkflowRun(
            workflowId,
            org.der.android.core.data.network.OpenRunRequestDto(businessKey = businessKey),
        )
        if (!response.isSuccessful) {
            val msg = when (response.code()) {
                404 -> "Workflow not found on this edge."
                409 -> "This workflow is disabled."
                else -> "HTTP ${response.code()}"
            }
            return OpenRunResult(null, msg)
        }
        val body = response.body() ?: return OpenRunResult(null, "Empty response")
        return OpenRunResult(
            run = WorkflowRun(
                runId = body.runId,
                workflowId = body.workflowId,
                businessKey = body.businessKey,
                state = body.state,
                createdAt = body.createdAt,
                updatedAt = body.updatedAt,
                submissionError = body.submissionError,
            ),
            error = null,
        )
    }

    /**
     * Apply a step contribution: POST to the edge and, on 2xx,
     * broadcast a DPP/1 workflow-advance frame to the mesh so any
     * downstream service point can advance without re-querying. The
     * HTTP path remains authoritative; the mesh path is best-effort.
     */
    suspend fun contribute(
        runId: String,
        stepId: String,
        payloadJson: String,
        nextOwnerDeviceId: String? = null,
    ): ContributeResult {
        val deviceId = identity.deviceId().toString()
        val request = ContributeStepRequestDto(payload = payloadJson, deviceId = deviceId)
        val response = api.contributeStep(runId, stepId, request)
        val body = response.body()
        if (!response.isSuccessful || body == null) {
            return ContributeResult(
                success = false,
                completed = false,
                readiness = emptyMap(),
                httpCode = response.code(),
                errorMessage = response.message(),
            )
        }
        val readiness = body.readiness.mapValues { Readiness.parse(it.value) }

        // Best-effort handoff: notify the next owner over the mesh.
        broadcastAdvance(runId, stepId, payloadJson, nextOwnerDeviceId)

        return ContributeResult(
            success = true,
            completed = body.completed,
            readiness = readiness,
            httpCode = response.code(),
            errorMessage = null,
        )
    }

    /**
     * Emit a DPP/1 workflow-advance frame. When [nextOwnerDeviceId]
     * is known we target it directly; otherwise the frame rides the
     * mesh with the edge as implicit relay (Phase 6 keeps the TTL
     * relay routing minimal — real relay lands with ADR-0038 §TTL).
     */
    private suspend fun broadcastAdvance(
        runId: String,
        stepId: String,
        payloadJson: String,
        nextOwnerDeviceId: String?,
    ) {
        runCatching {
            val frame = DppFrame(
                type = DppFrameType.FRAME,
                resource = "workflow",
                action = "run-advance",
                id = "$runId:$stepId",
                from = identity.deviceId().toString(),
                to = nextOwnerDeviceId,
                payload = payloadJson,
            )
            mesh.send(frame)
        }.onFailure { Timber.w(it, "workflow-advance broadcast failed") }
    }

    data class ContributeResult(
        val success: Boolean,
        val completed: Boolean,
        val readiness: Map<String, Readiness>,
        val httpCode: Int,
        val errorMessage: String?,
    )
}
