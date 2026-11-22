package org.der.android.feature.dataentry

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

/**
 * Simple aggregate-form screen. Phase 4 ships a flat list of
 * dataElements → text inputs — section-form rendering, option sets,
 * greyed fields and validation rules all land in later phases. The
 * submit button enqueues to the local capture journal and triggers
 * the WorkManager drain; the UI confirms with a small success line
 * and routes back on acknowledgement.
 */
@Composable
fun AggregateFormScreen(
    onSaved: () -> Unit,
    viewModel: AggregateFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.savedId) {
        if (state.savedId != null) onSaved()
    }
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = state.dataSet?.displayName ?: "Loading…",
                style = MaterialTheme.typography.headlineSmall,
            )
            state.dataSet?.periodType?.let {
                Text(
                    text = "Period type: $it",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (state.loading) {
                CircularProgressIndicator()
                return@Column
            }
            state.error?.let { err ->
                Text(
                    text = err,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
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
                value = state.period,
                onValueChange = viewModel::onPeriod,
                label = { Text("Period (e.g. 202611)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            state.dataSet?.dataElements?.forEach { de ->
                OutlinedTextField(
                    value = state.values[de.id].orEmpty(),
                    onValueChange = { v -> viewModel.onValue(de.id, v) },
                    label = { Text(de.displayName) },
                    singleLine = true,
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
            state.highErrors.forEach { v ->
                Text(
                    text = "Blocking: ${v.message}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            state.mediumOrLow.forEach { v ->
                Text(
                    text = "Warning: ${v.message}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.tertiary,
                )
            }
            if (state.mediumOrLow.isNotEmpty()) {
                androidx.compose.foundation.layout.Row(
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                ) {
                    androidx.compose.material3.Checkbox(
                        checked = state.overrideWarnings,
                        onCheckedChange = { viewModel.toggleOverride() },
                    )
                    Text(
                        text = "I acknowledge the warning(s) and want to save anyway.",
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }

            Button(
                enabled = state.canSubmit,
                onClick = viewModel::submit,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (state.submitting) "Saving…" else "Save")
            }
            Text(
                text = "Saved values queue locally first and sync to DER in the background when online.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
