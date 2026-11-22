package org.der.android.ui.shell

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Apps
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.der.android.core.domain.Session

/**
 * Compose equivalent of `client/src/shell/DerShell.tsx` — topbar with
 * launcher, user menu and online indicator. Caller renders screen
 * content inside the [content] lambda; [PaddingValues] expose the
 * Scaffold's inset so screens avoid the system bars.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DerShell(
    session: Session?,
    online: Boolean = true,
    onLauncherClick: () -> Unit = {},
    onSignOut: () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    var userMenu by remember { mutableStateOf(false) }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "DER",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        session?.let {
                            Spacer(Modifier.width(12.dp))
                            Text(
                                text = it.displayName ?: it.username,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
                actions = {
                    Icon(
                        imageVector = if (online) Icons.Outlined.CloudDone else Icons.Outlined.CloudOff,
                        contentDescription = if (online) "Online" else "Offline",
                        tint = if (online) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 4.dp).size(22.dp),
                    )
                    IconButton(onClick = onLauncherClick) {
                        Icon(
                            imageVector = Icons.Outlined.Apps,
                            contentDescription = "Open launcher",
                        )
                    }
                    IconButton(onClick = { userMenu = true }) {
                        Icon(
                            imageVector = Icons.Outlined.AccountCircle,
                            contentDescription = "Account menu",
                        )
                    }
                    DropdownMenu(
                        expanded = userMenu,
                        onDismissRequest = { userMenu = false },
                    ) {
                        session?.let {
                            DropdownMenuItem(
                                text = { Text(it.displayName ?: it.username) },
                                onClick = { userMenu = false },
                                enabled = false,
                            )
                        }
                        DropdownMenuItem(
                            text = { Text("Sign out") },
                            onClick = {
                                userMenu = false
                                onSignOut()
                            },
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                ),
            )
        },
        content = content,
    )
}
