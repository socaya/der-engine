package org.der.android.core.domain

/**
 * Tracks the client-local view of the DER device-trust lifecycle
 * (ADR-0019). Compare against the `status` field on the server-side
 * `der.network_client` row; we only need the three states the
 * client-side flow has to react to.
 */
enum class EnrolmentStatus {
    /** Device identity exists but no enrol request has been sent yet. */
    UNENROLLED,
    /** Enrol request accepted; waiting for an admin to approve. */
    PENDING,
    /** Admin approved the device; it can now sign in and sync. */
    APPROVED,
    /** Admin suspended or revoked the device; user must re-enrol. */
    BLOCKED,
    /** Transient — we couldn't reach the server to confirm status. */
    UNKNOWN,
}

data class DeviceEnrolment(
    val deviceId: String,
    val status: EnrolmentStatus,
    val displayName: String? = null,
    val lastCheckedAt: Long = System.currentTimeMillis(),
) {
    val canSignIn: Boolean get() = status == EnrolmentStatus.APPROVED
}

/** Admin-visible row from the device list. Broader than
 *  [DeviceEnrolment] because admins want to see who the device is
 *  assigned to, when it was last seen, and what hardware it is. */
data class EdgeDevice(
    val deviceId: String,
    val status: EnrolmentStatus,
    val displayName: String?,
    val formFactor: String?,
    val assignedUserId: String?,
    val lastSeenAt: String?,
    val enrolledAt: String?,
    val approvedAt: String?,
    val userAgent: String?,
)
