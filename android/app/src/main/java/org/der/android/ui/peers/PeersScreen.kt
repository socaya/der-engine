package org.der.android.ui.peers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Phase 3 landing for the Peers module — the operator-facing view
 * into the DER peer mesh (ADR-0038, DPP/1). WebRTC data channels +
 * discovery + session table arrive in a later phase; the module
 * namespace is reserved now so distributed-workflow routing has a
 * place to land when the transport is wired.
 */
@Composable
fun PeersScreen() {
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Peers", style = MaterialTheme.typography.headlineSmall)
            Text(
                text = "Device-to-device sessions over WebRTC land in a later " +
                    "phase. This client will act as both a DPP/1 originator " +
                    "and relay so workflow handoffs flow between service " +
                    "points without round-tripping the edge.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
