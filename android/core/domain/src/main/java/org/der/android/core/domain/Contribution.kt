package org.der.android.core.domain

data class Contribution(
    val contributionId: String,
    val runId: String,
    val stepId: String,
    val submittedBy: String?,
    val submittedDeviceId: String?,
    val submittedAt: String?,
)
