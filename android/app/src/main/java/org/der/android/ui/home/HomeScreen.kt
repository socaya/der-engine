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
import androidx.compose.ui.res.stringResource
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
    val expiry by viewModel.expiry.collectAsStateWithLifecycle()
    val renewing by viewModel.renewing.collectAsStateWithLifecycle()

    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    androidx.compose.runtime.DisposableEffect(lifecycleOwner) {
        val obs = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                viewModel.onResume()
            }
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }

    HomeContent(
        session = session,
        tiles = LauncherTiles.forSession(session),
        expiry = expiry,
        renewing = renewing,
        onKeepSignedIn = viewModel::keepSignedIn,
        onTile = onNavigate,
        onSignOut = { viewModel.signOut(onSignedOut) },
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HomeContent(
    session: Session?,
    tiles: List<LauncherTile>,
    expiry: HomeViewModel.ExpiryState = HomeViewModel.ExpiryState.None,
    renewing: Boolean = false,
    onKeepSignedIn: () -> Unit = {},
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
            SessionExpiryBanner(
                state = expiry,
                renewing = renewing,
                onKeepSignedIn = onKeepSignedIn,
            )
            Text(
                text = "Welcome${session?.displayName?.let { ", $it" } ?: session?.username?.let { ", $it" } ?: ""}",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
            )
            Text(
                text = stringResource(org.der.android.design.R.string.home_pick_workspace),
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
private fun SessionExpiryBanner(
    state: HomeViewModel.ExpiryState,
    renewing: Boolean,
    onKeepSignedIn: () -> Unit,
) {
    if (state !is HomeViewModel.ExpiryState.ExpiringSoon &&
        state !is HomeViewModel.ExpiryState.Expired) return

    val expired = state is HomeViewModel.ExpiryState.Expired
    val minsLeft = (state as? HomeViewModel.ExpiryState.ExpiringSoon)?.minutesLeft ?: 0

    Surface(
        shape = RoundedCornerShape(10.dp),
        color = if (expired) MaterialTheme.colorScheme.errorContainer
        else MaterialTheme.colorScheme.tertiaryContainer,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp),
    ) {
        androidx.compose.foundation.layout.Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = when {
                    expired -> stringResource(org.der.android.design.R.string.session_expired)
                    minsLeft == 1 -> stringResource(
                        org.der.android.design.R.string.session_expiring_soon_one,
                    )
                    else -> stringResource(
                        org.der.android.design.R.string.session_expiring_soon,
                        minsLeft,
                    )
                },
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
                color = if (expired) MaterialTheme.colorScheme.onErrorContainer
                else MaterialTheme.colorScheme.onTertiaryContainer,
            )
            if (!expired) {
                androidx.compose.material3.TextButton(
                    enabled = !renewing,
                    onClick = onKeepSignedIn,
                ) {
                    Text(
                        if (renewing) stringResource(org.der.android.design.R.string.session_renewing)
                        else stringResource(org.der.android.design.R.string.session_keep_signed_in),
                    )
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
        HomeContent(
            session = session,
            tiles = LauncherTiles.forSession(session),
            onTile = {},
            onSignOut = {},
        )
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
        HomeContent(
            session = session,
            tiles = LauncherTiles.forSession(session),
            onTile = {},
            onSignOut = {},
        )
    }
}
