package org.der.android.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.design.DerTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onSignedOut: () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val session by viewModel.session.collectAsStateWithLifecycle()
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("DER") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.primary,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Welcome, ${session?.displayName ?: session?.username ?: "operator"}",
                style = MaterialTheme.typography.headlineSmall,
            )
            Text(
                text = "This is the native Android client. Capture, dashboards, approvals and device admin arrive in subsequent phases per ADR-0041.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            session?.let { s ->
                Text(
                    text = "Roles: ${if (s.roles.isEmpty()) "none" else s.roles.joinToString()}",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            OutlinedButton(onClick = { viewModel.signOut(onSignedOut) }) {
                Text("Sign out")
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun HomePreview() {
    DerTheme { HomeScreen() }
}
