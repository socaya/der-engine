package org.der.android.feature.workflow

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
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
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(
                    selected = !state.allDevices,
                    onClick = { if (state.allDevices) viewModel.toggleAllDevices() },
                    label = { Text("This device") },
                )
                FilterChip(
                    selected = state.allDevices,
                    onClick = { if (!state.allDevices) viewModel.toggleAllDevices() },
                    label = { Text("All devices") },
                )
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
    }
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
    val (label, color) = when (readiness) {
        Readiness.READY -> "Ready" to MaterialTheme.colorScheme.primary
        Readiness.BLOCKED -> "Blocked" to MaterialTheme.colorScheme.error
        Readiness.PENDING -> "Pending" to MaterialTheme.colorScheme.secondary
        Readiness.DONE -> "Done" to MaterialTheme.colorScheme.primary
        Readiness.UNKNOWN -> "Unknown" to MaterialTheme.colorScheme.onSurfaceVariant
    }
    AssistChip(
        onClick = {},
        label = { Text(label) },
        colors = AssistChipDefaults.assistChipColors(
            labelColor = color,
        ),
    )
}
