package org.der.android.feature.devices

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.HourglassEmpty
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.DeviceEnrolment
import org.der.android.core.domain.EnrolmentStatus
import org.der.android.design.DerTheme

/**
 * "Waiting for admin approval" screen. Shows after sign-in when the
 * device is PENDING. Polls the device row via [EnrolmentViewModel];
 * routes to [onApproved] the moment the status flips to APPROVED.
 * Offers Sign out so the user can reset without force-killing the app.
 */
@Composable
fun EnrolmentScreen(
    onApproved: () -> Unit,
    onSignedOut: () -> Unit,
    viewModel: EnrolmentViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.enrolment?.status) {
        if (state.enrolment?.status == EnrolmentStatus.APPROVED) onApproved()
    }
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            EnrolmentCard(
                enrolment = state.enrolment,
                checking = state.checking,
                onRefresh = viewModel::refresh,
                onSignOut = { viewModel.signOut(onSignedOut) },
            )
        }
    }
}

@Composable
private fun EnrolmentCard(
    enrolment: DeviceEnrolment?,
    checking: Boolean,
    onRefresh: () -> Unit,
    onSignOut: () -> Unit,
) {
    val status = enrolment?.status ?: EnrolmentStatus.UNKNOWN
    Surface(
        tonalElevation = 2.dp,
        shadowElevation = 2.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier
            .widthIn(max = 420.dp)
            .padding(horizontal = 24.dp),
    ) {
        Column(
            modifier = Modifier.padding(28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                imageVector = iconFor(status),
                contentDescription = null,
                tint = tintFor(status),
                modifier = Modifier.height(48.dp),
            )
            Text(
                text = titleFor(status),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = bodyFor(status),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            enrolment?.deviceId?.let { id ->
                Text(
                    text = "Device: ${id.take(8)}…",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(4.dp))
            Button(
                onClick = onRefresh,
                enabled = !checking,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                if (checking) {
                    CircularProgressIndicator(
                        modifier = Modifier.height(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text("Check again")
                }
            }
            OutlinedButton(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Sign out")
            }
        }
    }
}

private fun iconFor(status: EnrolmentStatus) = when (status) {
    EnrolmentStatus.APPROVED -> Icons.Outlined.CheckCircle
    EnrolmentStatus.BLOCKED -> Icons.Outlined.ErrorOutline
    else -> Icons.Outlined.HourglassEmpty
}

@Composable
private fun tintFor(status: EnrolmentStatus) = when (status) {
    EnrolmentStatus.APPROVED -> MaterialTheme.colorScheme.primary
    EnrolmentStatus.BLOCKED -> MaterialTheme.colorScheme.error
    else -> MaterialTheme.colorScheme.secondary
}

private fun titleFor(status: EnrolmentStatus): String = when (status) {
    EnrolmentStatus.PENDING -> "Waiting for admin approval"
    EnrolmentStatus.APPROVED -> "Device approved"
    EnrolmentStatus.BLOCKED -> "Device blocked"
    EnrolmentStatus.UNENROLLED -> "Device not enrolled"
    EnrolmentStatus.UNKNOWN -> "Checking device status"
}

private fun bodyFor(status: EnrolmentStatus): String = when (status) {
    EnrolmentStatus.PENDING ->
        "An admin has to approve this device before it can sync data. " +
            "Ask them to open Admin → Devices → Enrolment."
    EnrolmentStatus.APPROVED ->
        "You can start using DER. Loading the home screen…"
    EnrolmentStatus.BLOCKED ->
        "An admin suspended or revoked this device. Sign out and " +
            "ask an admin to re-enrol."
    EnrolmentStatus.UNENROLLED ->
        "This device hasn't enrolled yet. Sign in again to enrol."
    EnrolmentStatus.UNKNOWN ->
        "Can't reach the DER edge right now. Check Wi-Fi and try again."
}

@Preview(showBackground = true)
@Composable
private fun PendingPreview() {
    DerTheme {
        EnrolmentCard(
            enrolment = DeviceEnrolment(
                deviceId = "11111111-2222-3333-4444-555555555555",
                status = EnrolmentStatus.PENDING,
            ),
            checking = false,
            onRefresh = {},
            onSignOut = {},
        )
    }
}

@Preview(showBackground = true, name = "Blocked")
@Composable
private fun BlockedPreview() {
    DerTheme {
        EnrolmentCard(
            enrolment = DeviceEnrolment(
                deviceId = "11111111-2222-3333-4444-555555555555",
                status = EnrolmentStatus.BLOCKED,
            ),
            checking = false,
            onRefresh = {},
            onSignOut = {},
        )
    }
}
