package org.der.android.feature.capture

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
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

/**
 * TEI detail screen: attribute card + Add-stage-event FAB. Mirrors
 * the identity header of `client/src/screens/TrackerDashboard.tsx`.
 */
@Composable
fun TeiDetailScreen(
    onAddStageEvent: () -> Unit,
    viewModel: TeiDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Box(modifier = Modifier.fillMaxSize()) {
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
                Text(
                    text = "Patient " + viewModel.teiUid,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (state.loading) {
                    CircularProgressIndicator()
                    return@Column
                }
                state.error?.let { err ->
                    Text(err, color = MaterialTheme.colorScheme.error)
                }
                state.tei?.let { tei ->
                    tei.orgUnit?.let { ou ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "Organisation unit:",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(text = ou, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                Text(
                    text = "Attributes",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 8.dp),
                )
                if (state.attributePairs.isEmpty()) {
                    Text(
                        text = "No attributes recorded on this patient.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        tonalElevation = 1.dp,
                        color = MaterialTheme.colorScheme.surface,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            state.attributePairs.forEach { (label, value) ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Text(
                                        text = value.ifBlank { "—" },
                                        style = MaterialTheme.typography.bodyMedium,
                                    )
                                }
                            }
                        }
                    }
                }

                Text(
                    text = "Enrolments",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 8.dp),
                )
                if (state.enrollments.isEmpty()) {
                    Text(
                        text = "No enrolments yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    state.enrollments.forEach { enrolment ->
                        EnrolmentBlock(enrolment)
                    }
                }
            }
            ExtendedFloatingActionButton(
                onClick = onAddStageEvent,
                icon = { Icon(Icons.Outlined.Add, contentDescription = null) },
                text = { Text("Add stage event") },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(24.dp),
            )
        }
    }
}

@Composable
private fun EnrolmentBlock(enrolment: org.der.android.core.domain.Enrollment) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        tonalElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "Programme " + (enrolment.programUid ?: "—"),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                org.der.android.design.DerStatus(
                    text = (enrolment.status ?: "—").lowercase()
                        .replaceFirstChar { it.uppercase() },
                    tone = when (enrolment.status?.uppercase()) {
                        "ACTIVE" -> org.der.android.design.DerStatusTone.Info
                        "COMPLETED" -> org.der.android.design.DerStatusTone.Success
                        "CANCELLED" -> org.der.android.design.DerStatusTone.Muted
                        else -> org.der.android.design.DerStatusTone.Muted
                    },
                )
            }
            Text(
                text = "Enrolled ${enrolment.enrollmentDate ?: "—"} · " +
                    "OU ${enrolment.orgUnitUid ?: "—"}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (enrolment.events.isEmpty()) {
                Text(
                    text = "No events yet.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Text(
                    text = "Events",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                enrolment.events.forEach { ev ->
                    Text(
                        text = "• ${ev.occurredAt?.take(10) ?: ev.event} · ${ev.status ?: "—"}",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
    }
}
