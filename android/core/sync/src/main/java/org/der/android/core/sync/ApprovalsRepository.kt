package org.der.android.core.sync

import org.der.android.core.data.network.DerApi
import org.der.android.core.data.network.RejectApprovalRequestDto
import org.der.android.core.domain.ApprovalOutcome
import org.der.android.core.domain.PendingApproval
import org.der.android.core.domain.ReferralEntry
import org.der.android.core.domain.ReferralOutcome
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Supervisor surface: pending approvals + referral inbox. Thin
 * wrapper mapping server DTOs to domain types.
 */
@Singleton
class ApprovalsRepository @Inject constructor(private val api: DerApi) {

    suspend fun pendingApprovals(limit: Int = 100): List<PendingApproval> {
        val response = api.pendingApprovals(limit)
        val body = response.body() ?: return emptyList()
        return body.rows.map {
            PendingApproval(
                operationId = it.operationId,
                entityType = it.entityType,
                entityRef = it.entityRef,
                submittedBy = it.submittedBy,
                createdAt = it.createdAt,
            )
        }
    }

    suspend fun approve(opId: String): ApprovalOutcome {
        val response = api.approveOperation(opId)
        if (response.isSuccessful) return ApprovalOutcome.parse(response.body()?.outcome)
        return when (response.code()) {
            404 -> ApprovalOutcome.NOT_FOUND
            409 -> ApprovalOutcome.parse(response.body()?.code)
                .takeIf { it != ApprovalOutcome.UNKNOWN } ?: ApprovalOutcome.ALREADY_DECIDED
            else -> ApprovalOutcome.UNKNOWN
        }
    }

    suspend fun reject(opId: String, reason: String): ApprovalOutcome {
        val response = api.rejectOperation(opId, RejectApprovalRequestDto(reason))
        if (response.isSuccessful) return ApprovalOutcome.parse(response.body()?.outcome)
        return when (response.code()) {
            404 -> ApprovalOutcome.NOT_FOUND
            409 -> ApprovalOutcome.parse(response.body()?.code)
                .takeIf { it != ApprovalOutcome.UNKNOWN } ?: ApprovalOutcome.ALREADY_DECIDED
            else -> ApprovalOutcome.UNKNOWN
        }
    }

    suspend fun referralInbox(limit: Int = 100): List<ReferralEntry> {
        val response = api.referralInbox(limit)
        val body = response.body() ?: return emptyList()
        return body.entries
            .filter { (it.status ?: "PENDING").uppercase() == "PENDING" }
            .map {
                ReferralEntry(
                    inboxId = it.inboxId,
                    kind = it.kind,
                    sourceRef = it.sourceRef,
                    boundOrgUnit = it.boundOrgUnit,
                    discoveredAt = it.discoveredAt,
                    status = it.status,
                )
            }
    }

    suspend fun acceptReferral(inboxId: String): ReferralOutcome {
        val response = api.acceptReferral(inboxId)
        val body = response.body()
        if (response.isSuccessful) return ReferralOutcome.parse(body?.status, body?.code)
        return when (response.code()) {
            404 -> ReferralOutcome.NOT_FOUND
            503 -> ReferralOutcome.INGEST_UNAVAILABLE
            502 -> ReferralOutcome.parse(null, body?.code)
            else -> ReferralOutcome.UNKNOWN
        }
    }

    suspend fun dismissReferral(inboxId: String): ReferralOutcome {
        val response = api.dismissReferral(inboxId)
        val body = response.body()
        if (response.isSuccessful) return ReferralOutcome.parse(body?.status, body?.code)
        return if (response.code() == 404) ReferralOutcome.NOT_FOUND else ReferralOutcome.UNKNOWN
    }
}
