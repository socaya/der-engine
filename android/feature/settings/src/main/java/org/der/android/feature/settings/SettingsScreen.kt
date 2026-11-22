package org.der.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun SettingsScreen(
    onWiped: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmWipe by remember { mutableStateOf(false) }

    LaunchedEffect(state.wiped) { if (state.wiped) onWiped() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Settings", style = MaterialTheme.typography.headlineSmall)

            SectionCard(title = "Server URL") {
                OutlinedTextField(
                    value = state.draftUrl,
                    onValueChange = viewModel::onDraftUrl,
                    label = { Text("DER server") },
                    singleLine = true,
                    isError = state.saveError != null,
                    supportingText = {
                        state.saveError?.let { Text(it) }
                            ?: Text("Current: ${state.serverUrl}")
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Button(
                        enabled = !state.saving && state.draftUrl != state.serverUrl,
                        onClick = viewModel::saveUrl,
                    ) { Text(if (state.saving) "Saving…" else "Save") }
                    OutlinedButton(onClick = viewModel::resetUrl, enabled = !state.saving) {
                        Text("Reset to default")
                    }
                }
            }

            SectionCard(title = "Diagnostics") {
                KeyValue("App version", state.appVersion)
                KeyValue("Device ID", state.deviceId)
                KeyValue("User agent", state.userAgent)
                KeyValue("Signed in as", state.username ?: "—")
                KeyValue("Pending captures", state.pendingCaptures.toString())
            }

            SectionCard(title = "Danger zone") {
                Text(
                    text = "Clearing local data signs out this user, drops every pending " +
                        "capture queued on this device and forces a fresh enrolment. The " +
                        "device identity UUID is regenerated.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(
                    onClick = { confirmWipe = true },
                    enabled = !state.wiping,
                ) {
                    Text(if (state.wiping) "Clearing…" else "Clear local data")
                }
            }
        }
    }

    if (confirmWipe) {
        AlertDialog(
            onDismissRequest = { confirmWipe = false },
            title = { Text("Clear local data?") },
            text = {
                Text(
                    "You have ${state.pendingCaptures} unsent capture(s). They will be " +
                        "deleted. Patient data already synced to DER is unaffected.",
                )
            },
            confirmButton = {
                Button(onClick = {
                    confirmWipe = false
                    viewModel.wipeLocalData()
                }) { Text("Yes, clear everything") }
            },
            dismissButton = {
                TextButton(onClick = { confirmWipe = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        tonalElevation = 1.dp,
        shadowElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            content()
        }
    }
}

@Composable
private fun KeyValue(key: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = key,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
