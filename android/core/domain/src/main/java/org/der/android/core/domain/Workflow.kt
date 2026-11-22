package org.der.android.core.domain

/** DER workflow-step readiness — mirrors the server's enum. */
enum class Readiness {
    READY,    // this step can be acted on now
    BLOCKED,  // a predecessor hasn't completed yet
    PENDING,  // waiting on an external signal (approval, referral intake)
    DONE,     // already contributed
    UNKNOWN;

    companion object {
        fun parse(raw: String?): Readiness = when (raw?.uppercase()) {
            "READY" -> READY
            "BLOCKED" -> BLOCKED
            "PENDING" -> PENDING
            "DONE" -> DONE
            else -> UNKNOWN
        }
    }
}

/**
 * One row of the operator's work queue — a step across all active
 * runs that the user can act on (or sees as blocked). Matches the
 * server's /edge-api/v1/workflows/queue row shape.
 */
data class WorkflowQueueRow(
    val runId: String,
    val workflowId: String,
    val workflowName: String,
    val businessKey: String,
    val stepId: String,
    val stepOrdinal: Int,
    val stepName: String,
    val ownerRole: String?,
    val ownerDeviceId: String?,
    val readiness: Readiness,
    val runCreatedAt: String?,
    val runUpdatedAt: String?,
    val validationErrorCount: Int,
) {
    val isActionable: Boolean get() = readiness == Readiness.READY
}

/**
 * One capture-workflow run — the per-encounter thread of steps that
 * routes through service points (Reception → Triage → Clinician → …).
 */
data class WorkflowRun(
    val runId: String,
    val workflowId: String,
    val businessKey: String,
    val state: String,
    val createdAt: String?,
    val updatedAt: String?,
    val submissionError: String?,
)
