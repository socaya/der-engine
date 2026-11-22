package org.der.android.feature.devices

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.EdgeDevice
import org.der.android.core.domain.EnrolmentStatus
import org.der.android.design.DerSegmentedControl
import org.der.android.design.DerStatus
import org.der.android.design.DerStatusTone

/**
 * Admin-facing device fleet view. Mirrors admin-UI's Devices →
 * Enrolment queue + fleet list in one scrollable surface, with
 * per-row Approve / Suspend / Revoke actions bound to the status.
 */
@Composable
fun DevicesScreen(viewModel: DevicesViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snack = remember { SnackbarHostState() }
    LaunchedEffect(state.toast) {
        state.toast?.let {
            snack.showSnackbar(it)
            viewModel.clearToast()
        }
    }
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Devices", style = MaterialTheme.typography.headlineSmall)
            Text(
                text = "Enrolled devices on this edge. Approve new tablets, suspend ones that shouldn't sign in, or revoke permanently.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            DerSegmentedControl(
                options = listOf(
                    DevicesViewModel.Filter.PENDING to "Pending",
                    DevicesViewModel.Filter.APPROVED to "Approved",
                    DevicesViewModel.Filter.BLOCKED to "Blocked",
                    DevicesViewModel.Filter.ALL to "All",
                ),
                selected = state.filter,
                onSelect = viewModel::onFilter,
            )
            Button(
                onClick = viewModel::refresh,
                enabled = !state.loading,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (state.loading) "Loading…" else "Refresh") }

            state.error?.let { err ->
                Text(err, color = MaterialTheme.colorScheme.error)
            }
            if (state.loading && state.devices.isEmpty()) {
                CircularProgressIndicator()
            }
            if (state.visible.isNotEmpty()) {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(items = state.visible, key = { it.deviceId }) { d ->
                        DeviceRow(
                            device = d,
                            busy = state.busy == d.deviceId,
                            onApprove = { viewModel.approve(d) },
                            onSuspend = { viewModel.suspend(d) },
                            onRevoke = { viewModel.revoke(d) },
                        )
                    }
                }
            } else if (!state.loading) {
                Text(
                    text = "No devices matching this filter.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        SnackbarHost(hostState = snack, modifier = Modifier.padding(16.dp)) { data ->
            Snackbar(snackbarData = data)
        }
    }
}

@Composable
private fun DeviceRow(
    device: EdgeDevice,
    busy: Boolean,
    onApprove: () -> Unit,
    onSuspend: () -> Unit,
    onRevoke: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        tonalElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = device.displayName ?: device.deviceId.take(12) + "…",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                DerStatus(
                    text = device.status.name.lowercase().replaceFirstChar { it.uppercase() },
                    tone = when (device.status) {
                        EnrolmentStatus.APPROVED -> DerStatusTone.Success
                        EnrolmentStatus.PENDING -> DerStatusTone.Warning
                        EnrolmentStatus.BLOCKED -> DerStatusTone.Danger
                        else -> DerStatusTone.Muted
                    },
                )
            }
            device.userAgent?.let { ua ->
                Text(
                    text = ua,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = buildString {
                    device.formFactor?.let { append("$it · ") }
                    device.lastSeenAt?.let { append("seen $it") }
                },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                when (device.status) {
                    EnrolmentStatus.PENDING -> {
                        Button(enabled = !busy, onClick = onApprove) {
                            Text(if (busy) "…" else "Approve")
                        }
                        OutlinedButton(enabled = !busy, onClick = onRevoke) { Text("Revoke") }
                    }
                    EnrolmentStatus.APPROVED -> {
                        OutlinedButton(enabled = !busy, onClick = onSuspend) {
                            Text(if (busy) "…" else "Suspend")
                        }
                        TextButton(enabled = !busy, onClick = onRevoke) { Text("Revoke") }
                    }
                    EnrolmentStatus.BLOCKED -> {
                        Button(enabled = !busy, onClick = onApprove) {
                            Text(if (busy) "…" else "Re-approve")
                        }
                    }
                    else -> {}
                }
            }
        }
    }
}
