package org.der.android.ui.shell

import org.der.android.core.domain.Session
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private fun session(vararg roles: String) = Session(
    userId = "u", username = "u", displayName = null,
    roles = roles.toList(), expiresAt = "2026-11-23T00:00:00Z",
)

class LauncherTilesTest {

    @Test fun chwSeesCaptureNotDevices() {
        val tiles = LauncherTiles.forSession(session("ROLE_CHW"))
        assertTrue(tiles.any { it.id == "data-entry" })
        assertTrue(tiles.any { it.id == "capture" })
        assertFalse(tiles.any { it.id == "devices" })
    }

    @Test fun supervisorSeesApprovals() {
        val tiles = LauncherTiles.forSession(session("ROLE_SUPERVISOR"))
        assertTrue(tiles.any { it.id == "approvals" })
    }

    @Test fun adminSeesEverything() {
        val tiles = LauncherTiles.forSession(session("ROLE_ADMIN"))
        val ids = tiles.map { it.id }.toSet()
        assertTrue(ids.contains("data-entry"))
        assertTrue(ids.contains("capture"))
        assertTrue(ids.contains("approvals"))
        assertTrue(ids.contains("devices"))
        assertTrue(ids.contains("sync"))
        assertTrue(ids.contains("settings"))
    }

    @Test fun workflowAndPeersAndSettingsAlwaysVisible() {
        val sessions = listOf(
            session("ROLE_CHW"),
            session("ROLE_SUPERVISOR"),
            session("ROLE_OPERATOR"),
            session("ROLE_ADMIN"),
            session(),
        )
        for (s in sessions) {
            val ids = LauncherTiles.forSession(s).map { it.id }.toSet()
            assertTrue("workflow should be visible for $s", ids.contains("workflow"))
            assertTrue("peers should be visible for $s", ids.contains("peers"))
            assertTrue("settings should be visible for $s", ids.contains("settings"))
        }
    }
}
