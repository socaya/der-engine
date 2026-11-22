package org.der.android.feature.capture

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.TrackedEntity

@Composable
fun TrackerSearchScreen(
    onEnrolNewPatient: () -> Unit,
    onOpenTei: (teiUid: String) -> Unit,
    viewModel: TrackerSearchViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = state.program?.displayName ?: "Loading…",
                style = MaterialTheme.typography.headlineSmall,
            )
            Text(
                text = "Tracker programme — enrol + stage new arrive in the next phase. Search here lists existing tracked entities.",
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
                onClick = viewModel::search,
                enabled = !state.loading && state.orgUnit.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (state.loading) "Searching…" else "Search")
            }
            androidx.compose.material3.OutlinedButton(
                onClick = onEnrolNewPatient,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Enrol a new patient") }
            state.error?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            if (state.loading && state.entities.isEmpty()) {
                CircularProgressIndicator()
            }
            if (state.entities.isNotEmpty()) {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(items = state.entities, key = { it.id }) { tei ->
                        TrackedEntityRow(tei, onClick = { onOpenTei(tei.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun TrackedEntityRow(tei: TrackedEntity, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(10.dp),
        tonalElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(tei.label, style = MaterialTheme.typography.titleMedium)
            Text(
                text = tei.id,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
