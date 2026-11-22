package org.der.android.feature.workflow

import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.Readiness
import org.der.android.core.domain.WorkflowQueueRow
import org.der.android.design.DerSegmentedControl
import org.der.android.design.DerStatus
import org.der.android.design.DerStatusTone

/**
 * DER Workflow landing — the operator's queue of in-flight runs at
 * their service point. Rows gated READY are tappable; BLOCKED /
 * PENDING are read-only (the tile shows why they're held). Matches
 * the web client's WorkflowActivity + WorkflowMonitoring queues.
 */
@Composable
fun WorkflowScreen(
    onOpenStep: (runId: String, stepId: String) -> Unit,
    viewModel: WorkflowQueueViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        androidx.compose.foundation.layout.Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Workflow", style = MaterialTheme.typography.headlineSmall)
            Text(
                text = "Service-point queue. Each row is one step on one run of a capture workflow.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            DerSegmentedControl(
                options = listOf(false to "This device", true to "All devices"),
                selected = state.allDevices,
                onSelect = { v -> if (v != state.allDevices) viewModel.toggleAllDevices() },
            )

            state.peerHandoff?.let { msg ->
                androidx.compose.foundation.layout.Row(
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    DerStatus(text = msg, tone = DerStatusTone.Info)
                    androidx.compose.material3.TextButton(onClick = viewModel::clearPeerHandoff) {
                        Text("Dismiss")
                    }
                }
            }
            when {
                state.loading -> CircularProgressIndicator()
                state.error != null -> {
                    Text(
                        text = state.error!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                    )
                    Button(onClick = viewModel::refresh) { Text("Retry") }
                }
                state.rows.isEmpty() -> Text(
                    text = "Queue is clear.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(items = state.rows, key = { "${it.runId}:${it.stepId}" }) { row ->
                        QueueRowCard(row, onClick = {
                            if (row.isActionable) onOpenStep(row.runId, row.stepId)
                        })
                    }
                }
            }
        }

        androidx.compose.material3.FloatingActionButton(
            onClick = viewModel::openCreateDialog,
            modifier = Modifier
                .align(androidx.compose.ui.Alignment.BottomEnd)
                .padding(24.dp),
        ) { Text("Start run") }
        } // end Box

        if (state.createDialogOpen) {
            OpenRunDialog(
                catalogue = state.catalogue,
                creating = state.creating,
                error = state.createError,
                onDismiss = viewModel::closeCreateDialog,
                onCreate = { wfId, bk -> viewModel.createRun(wfId, bk) },
            )
        }
    }
}

@Composable
private fun OpenRunDialog(
    catalogue: List<org.der.android.core.domain.WorkflowSummary>,
    creating: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onCreate: (workflowId: String, businessKey: String) -> Unit,
) {
    val selectedIdState = androidx.compose.runtime.remember {
        androidx.compose.runtime.mutableStateOf("")
    }
    val businessKeyState = androidx.compose.runtime.remember {
        androidx.compose.runtime.mutableStateOf("")
    }
    val selectedId = selectedIdState.value
    val businessKey = businessKeyState.value
    androidx.compose.runtime.LaunchedEffect(catalogue) {
        if (selectedId.isBlank()) selectedIdState.value =
            catalogue.firstOrNull()?.workflowId.orEmpty()
    }
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Start a new workflow run") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (catalogue.isEmpty()) {
                    Text(
                        "Loading workflows…",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Text(
                        "Workflow",
                        style = MaterialTheme.typography.labelLarge,
                    )
                    catalogue.forEach { wf ->
                        androidx.compose.foundation.layout.Row(
                            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedIdState.value = wf.workflowId }
                                .padding(vertical = 4.dp),
                        ) {
                            androidx.compose.material3.RadioButton(
                                selected = selectedId == wf.workflowId,
                                onClick = { selectedIdState.value = wf.workflowId },
                            )
                            Text(wf.displayName)
                        }
                    }
                }
                androidx.compose.material3.OutlinedTextField(
                    value = businessKey,
                    onValueChange = { businessKeyState.value = it },
                    label = { Text("Business key (eg. patient visit id)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !creating && selectedId.isNotBlank() && businessKey.isNotBlank(),
                onClick = { onCreate(selectedId, businessKey.trim()) },
            ) { Text(if (creating) "Starting…" else "Start") }
        },
        dismissButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

@Composable
private fun QueueRowCard(row: WorkflowQueueRow, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        enabled = row.isActionable,
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
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = row.workflowName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                ReadinessChip(row.readiness)
            }
            Text(
                text = "Step ${row.stepOrdinal} · ${row.stepName}",
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = "Case ${row.businessKey}" +
                    (row.ownerRole?.let { " · $it" } ?: ""),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (row.validationErrorCount > 0) {
                Text(
                    text = "${row.validationErrorCount} validation error(s)",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun ReadinessChip(readiness: Readiness) {
    val (label, tone) = when (readiness) {
        Readiness.READY -> "Ready" to DerStatusTone.Success
        Readiness.BLOCKED -> "Blocked" to DerStatusTone.Danger
        Readiness.PENDING -> "Pending" to DerStatusTone.Warning
        Readiness.DONE -> "Done" to DerStatusTone.Info
        Readiness.UNKNOWN -> "Unknown" to DerStatusTone.Muted
    }
    DerStatus(text = label, tone = tone)
}
