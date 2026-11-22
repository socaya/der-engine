package org.der.android.feature.capture

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import org.der.android.core.domain.EventRow
import org.der.android.design.DerStatus
import org.der.android.design.DerStatusTone

/**
 * Event list for an event (`WITHOUT_REGISTRATION`) program. Shows
 * the operator's OU events sorted newest first; the FAB routes to
 * EventNew for new entry.
 */
@Composable
fun EventListScreen(
    onNewEvent: () -> Unit,
    viewModel: EventListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = state.program?.displayName ?: "Loading…",
                    style = MaterialTheme.typography.headlineSmall,
                )
                Text(
                    text = "Events captured against this programme on the chosen organisation unit.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = state.orgUnit,
                    onValueChange = viewModel::onOrgUnit,
                    label = { Text("Organisation unit (UID)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(
                    enabled = !state.loading && state.orgUnit.isNotBlank(),
                    onClick = viewModel::refresh,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(if (state.loading) "Loading…" else "Load events") }

                state.error?.let { err ->
                    Text(
                        text = err,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                if (state.loading && state.events.isEmpty()) {
                    CircularProgressIndicator()
                }
                if (state.events.isNotEmpty()) {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(items = state.events, key = { it.event }) { ev ->
                            EventRowCard(ev)
                        }
                    }
                } else if (!state.loading && state.orgUnit.isNotBlank()) {
                    Text(
                        text = "No events for this OU yet. Tap + to capture one.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            ExtendedFloatingActionButton(
                onClick = onNewEvent,
                icon = { Icon(Icons.Outlined.Add, contentDescription = null) },
                text = { Text("New event") },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(24.dp),
            )
        }
    }
}

@Composable
private fun EventRowCard(ev: EventRow) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        tonalElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = ev.occurredAt?.take(10) ?: ev.event,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = ev.event,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            ev.status?.let { s ->
                DerStatus(
                    text = s.lowercase().replaceFirstChar { it.uppercase() },
                    tone = when (s.uppercase()) {
                        "ACTIVE" -> DerStatusTone.Info
                        "COMPLETED" -> DerStatusTone.Success
                        "CANCELLED", "SCHEDULE" -> DerStatusTone.Muted
                        else -> DerStatusTone.Muted
                    },
                )
            }
        }
    }
}
