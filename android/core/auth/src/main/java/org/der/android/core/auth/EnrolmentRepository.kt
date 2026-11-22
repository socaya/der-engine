package org.der.android.core.auth

import kotlinx.coroutines.delay
import org.der.android.core.data.device.DeviceIdentity
import org.der.android.core.data.network.DerApi
import org.der.android.core.data.network.EnrolDeviceRequestDto
import org.der.android.core.domain.DeviceEnrolment
import org.der.android.core.domain.EnrolmentStatus
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Drives the ADR-0019 device-enrolment lifecycle for the Android
 * client:
 *   1. [enrolIfNeeded]  — POST this device's UUID to the edge.
 *      Returns the current status; `PENDING` if the admin hasn't
 *      approved yet, `APPROVED` if they already did.
 *   2. [refreshStatus]  — GET the current device row; the waiting-
 *      for-approval screen calls this on a short interval.
 *   3. [awaitApproval]  — convenience polling loop used by UI
 *      flows that only care about the terminal state.
 */
@Singleton
class EnrolmentRepository @Inject constructor(
    private val api: DerApi,
    private val identity: DeviceIdentity,
) {

    suspend fun enrolIfNeeded(): DeviceEnrolment = try {
        val deviceId = identity.deviceId().toString()
        val response = api.enrolDevice(
            EnrolDeviceRequestDto(
                deviceId = deviceId,
                userAgent = identity.userAgent(),
            ),
        )
        when {
            response.isSuccessful && response.body() != null -> {
                val body = response.body()!!
                DeviceEnrolment(
                    deviceId = body.deviceId,
                    status = body.status.toEnrolmentStatus(),
                    displayName = body.displayName,
                )
            }
            // 409: already enrolled — treat as read-through to GET.
            response.code() == 409 -> refreshStatus()
            else -> DeviceEnrolment(deviceId, EnrolmentStatus.UNKNOWN)
        }
    } catch (_: IOException) {
        DeviceEnrolment(identity.deviceId().toString(), EnrolmentStatus.UNKNOWN)
    }

    suspend fun refreshStatus(): DeviceEnrolment = try {
        val deviceId = identity.deviceId().toString()
        val response = api.getDevice(deviceId)
        when {
            response.isSuccessful && response.body() != null -> {
                val body = response.body()!!
                DeviceEnrolment(
                    deviceId = body.deviceId,
                    status = body.status.toEnrolmentStatus(),
                    displayName = body.displayName,
                )
            }
            response.code() == 404 -> DeviceEnrolment(deviceId, EnrolmentStatus.UNENROLLED)
            else -> DeviceEnrolment(deviceId, EnrolmentStatus.UNKNOWN)
        }
    } catch (_: IOException) {
        DeviceEnrolment(identity.deviceId().toString(), EnrolmentStatus.UNKNOWN)
    }

    /**
     * Polls [refreshStatus] every [intervalMs] until the device is
     * APPROVED or BLOCKED, or [maxAttempts] is reached. Caller is
     * expected to show a "waiting for approval" screen during the
     * poll and handle the terminal state.
     */
    suspend fun awaitApproval(
        intervalMs: Long = 4_000L,
        maxAttempts: Int = 150,
    ): DeviceEnrolment {
        repeat(maxAttempts) {
            val now = refreshStatus()
            if (now.status == EnrolmentStatus.APPROVED
                || now.status == EnrolmentStatus.BLOCKED) {
                return now
            }
            delay(intervalMs)
        }
        return refreshStatus()
    }
}

private fun String.toEnrolmentStatus(): EnrolmentStatus = when (uppercase()) {
    "APPROVED" -> EnrolmentStatus.APPROVED
    "PENDING" -> EnrolmentStatus.PENDING
    "SUSPENDED", "REVOKED", "BLOCKED" -> EnrolmentStatus.BLOCKED
    else -> EnrolmentStatus.UNKNOWN
}
