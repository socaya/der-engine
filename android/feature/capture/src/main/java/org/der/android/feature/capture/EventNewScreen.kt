package org.der.android.feature.capture

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.design.DerSegmentedControl

@Composable
fun EventNewScreen(
    onSaved: () -> Unit,
    viewModel: EventNewViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.savedId) { if (state.savedId != null) onSaved() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = state.program?.displayName ?: "Loading…",
                style = MaterialTheme.typography.headlineSmall,
            )
            if (state.loading) {
                CircularProgressIndicator()
                return@Column
            }
            state.error?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            state.program?.stages?.takeIf { it.size > 1 }?.let { stages ->
                Text(
                    text = "Stage",
                    style = MaterialTheme.typography.labelLarge,
                )
                DerSegmentedControl(
                    options = stages.map { it.id to it.displayName },
                    selected = state.stageId ?: stages.first().id,
                    onSelect = viewModel::onStage,
                )
            }

            OutlinedTextField(
                value = state.orgUnit,
                onValueChange = viewModel::onOrgUnit,
                label = { Text("Organisation unit (UID)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.occurredDate,
                onValueChange = viewModel::onOccurredDate,
                label = { Text("Date (YYYY-MM-DD)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            // Display-text effects bubble up above the inputs so
            // operators see guidance before entering values.
            state.evaluation.displayTexts.forEach { txt ->
                Text(
                    text = txt.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            state.visibleDataElements.forEach { de ->
                val isMandatory = de.id in state.evaluation.mandatoryFields
                val assignedByRule = de.id in state.evaluation.assignments
                OutlinedTextField(
                    value = state.values[de.id].orEmpty(),
                    onValueChange = { v -> viewModel.onValue(de.id, v) },
                    label = {
                        Text(if (isMandatory) "${de.displayName} *" else de.displayName)
                    },
                    singleLine = true,
                    readOnly = assignedByRule,
                    supportingText = if (assignedByRule) {
                        { Text("Set automatically by a program rule.") }
                    } else null,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = when (de.valueType) {
                            "NUMBER", "INTEGER", "INTEGER_POSITIVE",
                            "INTEGER_ZERO_OR_POSITIVE", "PERCENTAGE" -> KeyboardType.Number
                            else -> KeyboardType.Text
                        },
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            state.evaluation.warnings
                .filter { !it.onComplete }
                .forEach { w ->
                    Text(
                        text = "Warning: ${w.message}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.tertiary,
                    )
                }
            state.evaluation.errors.forEach { err ->
                Text(
                    text = "Error: ${err.message}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            if (state.missingMandatory.isNotEmpty()) {
                Text(
                    text = "Required fields missing (${state.missingMandatory.size}).",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            Button(
                enabled = state.canSubmit,
                onClick = viewModel::submit,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (state.submitting) "Saving…" else "Save event")
            }
            Text(
                text = "Events queue locally and sync to DER in the background when online.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
