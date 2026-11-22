package org.der.android.feature.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.CapturePending

/**
 * DER Dashboard — read-mostly rollup of edge reachability, local
 * capture queue, peer mesh and recent work. Mirrors the composition
 * of `client/src/screens/SyncStatus + NetworkStatus + Dhis2Status +
 * RecentWork` into one surface because mobile screens prefer fewer
 * tap targets.
 */
@Composable
fun DashboardScreen(viewModel: DashboardViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Dashboard", style = MaterialTheme.typography.headlineSmall)

            StatusCard(
                title = "Edge",
                tone = if (state.edgeReachable) Tone.Good else Tone.Bad,
                headline = if (state.edgeReachable) "Reachable" else "Offline",
                subtitle = state.edgeLastError ?: "The DER edge probes every 10 seconds.",
            )

            StatusCard(
                title = "Sync queue",
                tone = when {
                    state.pending == 0 -> Tone.Good
                    state.pending < 10 -> Tone.Info
                    else -> Tone.Warn
                },
                headline = if (state.pending == 0) "All sent" else "${state.pending} pending",
                subtitle = "Captures drain when online. Tap Drain now to try immediately.",
                action = { Button(onClick = viewModel::drainNow) { Text("Drain now") } },
            )

            StatusCard(
                title = "Peers",
                tone = if (state.peers > 0) Tone.Good else Tone.Info,
                headline = if (state.peers == 0) "No peers yet" else "${state.peers} connected",
                subtitle = "Device-to-device sessions on this clinic LAN (DPP/1 over WebRTC).",
            )

            Text(
                "Captures this week",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            ActivityChart(state.activity)

            Text(
                "Recent work",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            if (state.recent.isEmpty()) {
                Text(
                    text = "Nothing captured on this device yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                state.recent.forEach { RecentRow(it) }
            }
        }
    }
}

private enum class Tone { Good, Info, Warn, Bad }

@Composable
private fun StatusCard(
    title: String,
    tone: Tone,
    headline: String,
    subtitle: String,
    action: (@Composable () -> Unit)? = null,
) {
    val color = when (tone) {
        Tone.Good -> MaterialTheme.colorScheme.primary
        Tone.Info -> MaterialTheme.colorScheme.secondary
        Tone.Warn -> MaterialTheme.colorScheme.tertiary
        Tone.Bad -> MaterialTheme.colorScheme.error
    }
    Surface(
        shape = RoundedCornerShape(12.dp),
        tonalElevation = 1.dp,
        shadowElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                modifier = Modifier
                    .padding(top = 6.dp)
                    .size(10.dp)
                    .background(color = color, shape = CircleShape),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(headline, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            action?.let {
                Spacer(Modifier.height(0.dp))
                it()
            }
        }
    }
}

@Composable
private fun RecentRow(entry: CapturePending) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        tonalElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(entry.summary, style = MaterialTheme.typography.bodyMedium)
            Text(
                text = "attempts: ${entry.attempts}" +
                    (entry.lastError?.let { " · $it" } ?: ""),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ActivityChart(days: List<DashboardViewModel.Day>) {
    val total = days.sumOf { it.sentCount }
    if (days.isEmpty() || total == 0) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            tonalElevation = 1.dp,
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = "Nothing sent in the last 7 days.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(14.dp),
            )
        }
        return
    }
    val max = days.maxOf { it.sentCount }.coerceAtLeast(1)
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
            androidx.compose.foundation.layout.Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = androidx.compose.ui.Alignment.Bottom,
            ) {
                days.forEach { d ->
                    androidx.compose.foundation.layout.Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = if (d.sentCount == 0) " " else d.sentCount.toString(),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        androidx.compose.foundation.layout.Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height((80f * (d.sentCount / max.toFloat())).dp
                                    .coerceAtLeast(4.dp))
                                .background(
                                    color = if (d.sentCount == 0)
                                        MaterialTheme.colorScheme.surfaceVariant
                                    else MaterialTheme.colorScheme.primary,
                                    shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp),
                                ),
                        )
                    }
                }
            }
            androidx.compose.foundation.layout.Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                days.forEach { d ->
                    Text(
                        text = d.label,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
            }
            Text(
                text = "$total sent",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
