package org.der.android.ui.home

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.der.android.core.domain.Session
import org.der.android.design.DerTheme
import org.der.android.ui.shell.DerShell
import org.der.android.ui.shell.LauncherTile
import org.der.android.ui.shell.LauncherTiles

@Composable
fun HomeScreen(
    onNavigate: (route: String) -> Unit,
    onSignedOut: () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val session by viewModel.session.collectAsStateWithLifecycle()
    HomeContent(
        session = session,
        tiles = LauncherTiles.forSession(session),
        onTile = onNavigate,
        onSignOut = { viewModel.signOut(onSignedOut) },
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HomeContent(
    session: Session?,
    tiles: List<LauncherTile>,
    onTile: (String) -> Unit,
    onSignOut: () -> Unit,
) {
    DerShell(
        session = session,
        onSignOut = onSignOut,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
        ) {
            Text(
                text = "Welcome${session?.displayName?.let { ", $it" } ?: session?.username?.let { ", $it" } ?: ""}",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
            )
            Text(
                text = "Pick a workspace to start.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 16.dp),
            )
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(items = tiles, key = { it.id }) { tile ->
                    TileCard(tile = tile, onClick = { onTile(tile.route) })
                }
            }
        }
    }
}

@Composable
private fun TileCard(tile: LauncherTile, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        tonalElevation = 1.dp,
        shadowElevation = 1.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1.3f),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalAlignment = Alignment.Start,
        ) {
            Icon(
                imageVector = tile.icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(28.dp),
            )
            Text(
                text = tile.label,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = tile.subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun HomeChwPreview() {
    DerTheme {
        val session = Session(
            userId = "u1", username = "chw.jane",
            displayName = "Jane C.",
            roles = listOf("ROLE_CHW"),
            expiresAt = "2026-11-23T00:00:00Z",
        )
        HomeContent(session, LauncherTiles.forSession(session), {}, {})
    }
}

@Preview(showBackground = true, name = "Admin Home")
@Composable
private fun HomeAdminPreview() {
    DerTheme {
        val session = Session(
            userId = "u1", username = "admin",
            displayName = "Admin",
            roles = listOf("ROLE_ADMIN"),
            expiresAt = "2026-11-23T00:00:00Z",
        )
        HomeContent(session, LauncherTiles.forSession(session), {}, {})
    }
}
