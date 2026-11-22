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

/**
 * Enrol a brand-new tracked entity into the picked tracker programme.
 * Mirrors `client/src/screens/EnrollmentCreate.tsx` — attribute
 * capture with program-rule effects (hide / mandatory / assign /
 * warn / error), orgUnit input, and a single Enrol button.
 */
@Composable
fun TrackerEnrolScreen(
    onEnrolled: () -> Unit,
    viewModel: TrackerEnrolViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.success) { if (state.success != null) onEnrolled() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = state.program?.displayName?.let { "Enrol into $it" } ?: "Loading…",
                style = MaterialTheme.typography.headlineSmall,
            )
            Text(
                text = "Register a new patient and open their first enrolment in one step.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (state.loading) {
                CircularProgressIndicator()
                return@Column
            }

            state.evaluation.displayTexts.forEach { txt ->
                Text(
                    text = txt.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            OutlinedTextField(
                value = state.orgUnit,
                onValueChange = viewModel::onOrgUnit,
                label = { Text("Organisation unit (UID)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            state.visibleAttributes.forEach { attr ->
                val isMandatory = attr.id in state.evaluation.mandatoryFields
                val assigned = attr.id in state.evaluation.assignments
                OutlinedTextField(
                    value = state.attributes[attr.id].orEmpty(),
                    onValueChange = { v -> viewModel.onAttribute(attr.id, v) },
                    label = {
                        Text(if (isMandatory) "${attr.displayName} *" else attr.displayName)
                    },
                    singleLine = true,
                    readOnly = assigned,
                    supportingText = if (assigned) {
                        { Text("Set automatically by a program rule.") }
                    } else null,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = when (attr.valueType) {
                            "NUMBER", "INTEGER", "INTEGER_POSITIVE",
                            "INTEGER_ZERO_OR_POSITIVE", "PERCENTAGE" -> KeyboardType.Number
                            "PHONE_NUMBER" -> KeyboardType.Phone
                            "EMAIL" -> KeyboardType.Email
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
                    text = "Required attributes missing (${state.missingMandatory.size}).",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            state.error?.let { err ->
                Text(
                    text = err,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            Button(
                enabled = state.canSubmit,
                onClick = viewModel::enrol,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (state.submitting) "Enrolling…" else "Enrol")
            }
            Text(
                text = "The patient and their enrolment land on the DER edge immediately; later events capture against them via Workflow or Capture.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
