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
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.ProgramSummary
import org.der.android.core.domain.ProgramType

/**
 * DER Capture landing — list of programs. Tapping an event program
 * routes to EventNew; tapping a tracker program routes to
 * TrackerSearch.
 */
@Composable
fun CaptureScreen(
    onOpen: (programId: String, type: ProgramType) -> Unit,
    viewModel: ProgramPickerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Capture", style = MaterialTheme.typography.headlineSmall)
            Text(
                text = "Pick a program. Event programs capture a single visit; tracker programs enroll a person into an ongoing programme.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
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
                state.programs.isEmpty() -> Text(
                    text = "No programs visible for this facility yet. Check with an admin that the DHIS2 metadata sync has run.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(items = state.programs, key = { it.id }) { p ->
                        ProgramRow(p, onClick = { onOpen(p.id, p.type) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ProgramRow(p: ProgramSummary, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(10.dp),
        tonalElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(p.displayName, style = MaterialTheme.typography.titleMedium)
            Text(
                text = when (p.type) {
                    ProgramType.WITH_REGISTRATION -> "Tracker programme"
                    ProgramType.WITHOUT_REGISTRATION -> "Event programme"
                },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
