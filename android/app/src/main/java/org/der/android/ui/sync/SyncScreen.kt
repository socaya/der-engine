package org.der.android.ui.sync

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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.CapturePending
import org.der.android.design.DerStatus
import org.der.android.design.DerStatusTone

/**
 * Sync / Drafts — the operator's view into the local capture
 * journal. Each row shows its status, attempts, last error and
 * offers Retry (re-queue on the drain chain) or Discard (drop
 * entirely).
 */
@Composable
fun SyncScreen(viewModel: SyncViewModel = hiltViewModel()) {
    val rows by viewModel.rows.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Sync", style = MaterialTheme.typography.headlineSmall)
            Text(
                text = "Everything captured on this device lives here until the DER edge acknowledges it.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = viewModel::drainNow) { Text("Drain now") }
                val pendingCount = rows.count { it.summary.endsWith(" · PENDING") }
                Text(
                    text = "$pendingCount pending",
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(start = 8.dp).align(Alignment.CenterVertically),
                )
            }

            if (rows.isEmpty()) {
                Text(
                    text = "Nothing captured yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(rows, key = { it.id }) { row ->
                        DraftRow(
                            row = row,
                            onRetry = { viewModel.retry(row.id) },
                            onDiscard = { viewModel.discard(row.id) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DraftRow(
    row: CapturePending,
    onRetry: () -> Unit,
    onDiscard: () -> Unit,
) {
    val status = row.summary.substringAfterLast(" · ")
    val tone = when (status) {
        "SENT" -> DerStatusTone.Success
        "FAILED" -> DerStatusTone.Danger
        "PENDING" -> DerStatusTone.Info
        else -> DerStatusTone.Muted
    }
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
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = row.summary.substringBefore(" · "),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                DerStatus(text = status, tone = tone)
            }
            Text(
                text = row.summary.removePrefix(row.summary.substringBefore(" · "))
                    .removePrefix(" · ")
                    .removeSuffix(" · $status"),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            row.lastError?.let { err ->
                Text(
                    text = "Last error: $err",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Text(
                text = "Attempts: ${row.attempts}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (status != "SENT") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onRetry) { Text("Retry") }
                    TextButton(onClick = onDiscard) { Text("Discard") }
                }
            } else {
                TextButton(onClick = onDiscard) { Text("Remove from list") }
            }
        }
    }
}
