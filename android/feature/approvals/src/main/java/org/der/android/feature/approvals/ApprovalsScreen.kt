package org.der.android.feature.approvals

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.PendingApproval
import org.der.android.core.domain.ReferralEntry

@Composable
fun ApprovalsScreen(viewModel: ApprovalsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snack = remember { SnackbarHostState() }
    var rejectFor by remember { mutableStateOf<String?>(null) }
    var rejectReason by remember { mutableStateOf("") }

    LaunchedEffect(state.toast) {
        state.toast?.let { snack.showSnackbar(it); viewModel.clearToast() }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Approvals", style = MaterialTheme.typography.headlineSmall)
            Text(
                text = "Supervisor queue — operations awaiting your decision and referrals routed to this facility.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (state.loading) {
                CircularProgressIndicator()
                return@Column
            }
            state.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error)
                Button(onClick = viewModel::refresh) { Text("Retry") }
            }

            Text(
                "Pending approvals",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            if (state.approvals.isEmpty()) {
                Text(
                    "Nothing awaiting approval.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                state.approvals.forEach { approval ->
                    ApprovalCard(
                        approval = approval,
                        busy = state.busyOp == approval.operationId,
                        onApprove = { viewModel.approve(approval.operationId) },
                        onReject = { rejectFor = approval.operationId; rejectReason = "" },
                    )
                }
            }

            Text(
                "Referrals routed here",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 8.dp),
            )
            if (state.referrals.isEmpty()) {
                Text(
                    "Inbox empty.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                state.referrals.forEach { entry ->
                    ReferralCard(
                        entry = entry,
                        busy = state.busyOp == entry.inboxId,
                        onAccept = { viewModel.acceptReferral(entry.inboxId) },
                        onDismiss = { viewModel.dismissReferral(entry.inboxId) },
                    )
                }
            }
        }
        SnackbarHost(
            hostState = snack,
            modifier = Modifier.padding(16.dp),
        ) { data -> Snackbar(snackbarData = data) }
    }

    rejectFor?.let { opId ->
        AlertDialog(
            onDismissRequest = { rejectFor = null },
            title = { Text("Reject this operation?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("A reason is required — recorded in the audit log.")
                    OutlinedTextField(
                        value = rejectReason,
                        onValueChange = { rejectReason = it },
                        label = { Text("Reason") },
                        singleLine = false,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                Button(
                    enabled = rejectReason.isNotBlank(),
                    onClick = {
                        viewModel.reject(opId, rejectReason.trim())
                        rejectFor = null
                    },
                ) { Text("Reject") }
            },
            dismissButton = {
                OutlinedButton(onClick = { rejectFor = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun ApprovalCard(
    approval: PendingApproval,
    busy: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit,
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
            Text(
                text = approval.entityType ?: "Operation",
                style = MaterialTheme.typography.titleMedium,
            )
            approval.entityRef?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            Text(
                text = "Submitted ${approval.createdAt ?: "—"}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Button(onClick = onApprove, enabled = !busy) {
                    Text(if (busy) "Working…" else "Approve")
                }
                OutlinedButton(onClick = onReject, enabled = !busy) { Text("Reject") }
            }
        }
    }
}

@Composable
private fun ReferralCard(
    entry: ReferralEntry,
    busy: Boolean,
    onAccept: () -> Unit,
    onDismiss: () -> Unit,
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
            Text(
                text = entry.kind ?: "Referral",
                style = MaterialTheme.typography.titleMedium,
            )
            entry.sourceRef?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }
            Text(
                text = buildString {
                    entry.boundOrgUnit?.let { append("OU $it · ") }
                    append("Arrived ${entry.discoveredAt ?: "—"}")
                },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onAccept, enabled = !busy) {
                    Text(if (busy) "Working…" else "Accept")
                }
                OutlinedButton(onClick = onDismiss, enabled = !busy) { Text("Dismiss") }
            }
        }
    }
}
