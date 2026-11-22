package org.der.android.ui.peers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.p2p.PeerMesh

/**
 * Peers list — mirrors the operator-facing peer mesh view from the
 * web client. Phase 3.5 shows connected peers; peer management
 * actions land in a later phase.
 */
@Composable
fun PeersScreen(viewModel: PeersViewModel = hiltViewModel()) {
    val peers by viewModel.peers.collectAsStateWithLifecycle()
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Peers", style = MaterialTheme.typography.headlineSmall)
            Text(
                text = "Device-to-device sessions in this clinic (DPP/1 over WebRTC).",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (peers.isEmpty()) {
                Text(
                    text = "No peers connected yet. Discover and handshake run " +
                        "in the background; peers appear here as sessions open.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(items = peers, key = { it.deviceId }) { peer ->
                        PeerRow(peer)
                    }
                }
            }
        }
    }
}

@Composable
private fun PeerRow(peer: PeerMesh.Peer) {
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
                text = peer.displayName ?: peer.deviceId.take(12) + "…",
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = buildString {
                    append(if (peer.reachable) "Reachable" else "Offline")
                    append(" · ")
                    append(peer.trust.name.lowercase().replaceFirstChar { it.uppercase() })
                },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
