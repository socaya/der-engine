package org.der.android.feature.workflow

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

/**
 * Contribute to one workflow step. Phase 6 keeps the payload a free-
 * form JSON blob — matching the server's `payload: String` contract.
 * The optional "Next owner device" field pins the DPP/1 workflow-
 * advance frame to a specific service-point tablet so the baton
 * travels directly over WebRTC.
 */
@Composable
fun WorkflowRunScreen(
    onDone: () -> Unit,
    viewModel: WorkflowRunViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.completed) { if (state.completed) onDone() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = state.run?.businessKey?.let { "Case $it" } ?: "Loading…",
                style = MaterialTheme.typography.headlineSmall,
            )
            if (state.loading) {
                CircularProgressIndicator()
                return@Column
            }
            state.run?.state?.let { s ->
                Text(
                    text = "Run state: $s",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            state.error?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            OutlinedTextField(
                value = state.payload,
                onValueChange = viewModel::onPayload,
                label = { Text("Step payload (JSON)") },
                placeholder = { Text("{ \"triage\": \"urgent\" }") },
                modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
            )
            OutlinedTextField(
                value = state.nextOwnerDeviceId,
                onValueChange = viewModel::onNextOwner,
                label = { Text("Next owner device (UUID, optional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                enabled = state.canSubmit,
                onClick = viewModel::contribute,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (state.submitting) "Advancing…" else "Advance step")
            }
            Text(
                text = "Advancing this step posts the contribution to the edge and broadcasts a DPP/1 workflow-advance frame over the peer mesh so the next service point auto-receives the baton.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
