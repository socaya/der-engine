package org.der.android.ui.shell

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.PersonPinCircle
import androidx.compose.material.icons.outlined.Route
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.ui.graphics.vector.ImageVector
import org.der.android.core.domain.Session

/**
 * The DER launcher tiles, mirroring `client/src/shell/modules.ts`.
 * Role filtering decides which tiles the authenticated user sees —
 * CHWs don't need Devices, operators don't need Capture, admins see
 * everything.
 */
data class LauncherTile(
    val id: String,
    val label: String,
    val subtitle: String,
    val route: String,
    val icon: ImageVector,
)

object LauncherTiles {

    val DATA_ENTRY = LauncherTile(
        id = "data-entry",
        label = "Data entry",
        subtitle = "Aggregate datasets",
        route = "data-entry",
        icon = Icons.Outlined.Assignment,
    )

    val CAPTURE = LauncherTile(
        id = "capture",
        label = "Capture",
        subtitle = "Tracker + events",
        route = "capture",
        icon = Icons.Outlined.Edit,
    )

    val WORKFLOW = LauncherTile(
        id = "workflow",
        label = "Workflow",
        subtitle = "Service-point steps",
        route = "workflow",
        icon = Icons.Outlined.Route,
    )

    val DASHBOARD = LauncherTile(
        id = "dashboard",
        label = "Dashboard",
        subtitle = "Sync · network · recent",
        route = "dashboard",
        icon = Icons.Outlined.Dashboard,
    )

    val APPROVALS = LauncherTile(
        id = "approvals",
        label = "Approvals",
        subtitle = "Supervisor queue + referrals",
        route = "approvals",
        icon = Icons.Outlined.Checklist,
    )

    val PEERS = LauncherTile(
        id = "peers",
        label = "Peers",
        subtitle = "Device-to-device sessions",
        route = "peers",
        icon = Icons.Outlined.Hub,
    )

    val SYNC = LauncherTile(
        id = "sync",
        label = "Sync",
        subtitle = "Jobs · drift · worker",
        route = "sync",
        icon = Icons.Outlined.Sync,
    )

    val DEVICES = LauncherTile(
        id = "devices",
        label = "Devices",
        subtitle = "Fleet + enrolment",
        route = "devices",
        icon = Icons.Outlined.PersonPinCircle,
    )

    val SETTINGS = LauncherTile(
        id = "settings",
        label = "Settings",
        subtitle = "Server URL · about",
        route = "settings",
        icon = Icons.Outlined.Settings,
    )

    /**
     * Tiles visible for the given session. Roles follow the DER
     * naming used server-side (ROLE_CHW, ROLE_SUPERVISOR, ROLE_ADMIN,
     * ROLE_OPERATOR). Anyone sees Workflow + Peers + Dashboard +
     * Settings; CHW sees Data Entry + Capture; supervisors see
     * Approvals; admins additionally see Devices + Sync.
     */
    fun forSession(session: Session?): List<LauncherTile> {
        val roles = session?.roles?.map { it.uppercase() }.orEmpty()
        val isAdmin = session?.isAdmin == true
        val isSupervisor = session?.isSupervisor == true
        val isChw = roles.any { it == "ROLE_CHW" || it == "ROLE_NURSE" || it == "ROLE_CLINICIAN" }
        val isOperator = roles.any { it == "ROLE_OPERATOR" || it == "ROLE_FACILITY_OPERATOR" }

        return buildList {
            // CHW tooling
            if (isChw || isAdmin) {
                add(DATA_ENTRY)
                add(CAPTURE)
            }
            // Always — workflow is the DER core concept everyone touches
            add(WORKFLOW)
            // Operator / everyone
            if (isOperator || isAdmin || !isChw) add(DASHBOARD)
            // Supervisor queue
            if (isSupervisor || isAdmin) add(APPROVALS)
            // Peers + Sync are always visible; distributed workflow depends on them
            add(PEERS)
            add(SYNC)
            // Admin-only
            if (isAdmin) {
                add(DEVICES)
            }
            add(SETTINGS)
        }
    }
}
