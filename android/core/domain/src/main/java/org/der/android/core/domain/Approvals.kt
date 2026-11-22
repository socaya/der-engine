package org.der.android.core.domain

data class PendingApproval(
    val operationId: String,
    val entityType: String?,
    val entityRef: String?,
    val submittedBy: String?,
    val createdAt: String?,
)

enum class ApprovalOutcome {
    APPROVED,
    REJECTED,
    NOT_FOUND,
    NOT_REQUIRED,
    ALREADY_DECIDED,
    UNKNOWN;

    companion object {
        fun parse(raw: String?): ApprovalOutcome = when (raw?.uppercase()) {
            "APPROVED" -> APPROVED
            "REJECTED" -> REJECTED
            "NOT_FOUND" -> NOT_FOUND
            "APPROVAL_NOT_REQUIRED", "NOT_REQUIRED" -> NOT_REQUIRED
            "APPROVAL_ALREADY_DECIDED", "ALREADY_DECIDED" -> ALREADY_DECIDED
            else -> UNKNOWN
        }
    }
}

data class ReferralEntry(
    val inboxId: String,
    val kind: String?,
    val sourceRef: String?,
    val boundOrgUnit: String?,
    val discoveredAt: String?,
    val status: String?,
)

enum class ReferralOutcome {
    ACCEPTED,
    DISMISSED,
    INGEST_UNAVAILABLE,
    INGEST_FAILED,
    INGEST_REJECTED,
    NOT_FOUND,
    UNKNOWN;

    companion object {
        fun parse(status: String?, code: String?): ReferralOutcome = when {
            status == "ACCEPTED" -> ACCEPTED
            status == "DISMISSED" -> DISMISSED
            code == "INGEST_UNAVAILABLE" -> INGEST_UNAVAILABLE
            code == "INGEST_FAILED" -> INGEST_FAILED
            code == "INGEST_REJECTED" -> INGEST_REJECTED
            else -> UNKNOWN
        }
    }
}
