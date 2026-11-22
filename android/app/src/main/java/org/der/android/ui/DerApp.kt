package org.der.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import org.der.android.core.domain.ProgramType
import org.der.android.feature.approvals.ApprovalsScreen
import org.der.android.feature.capture.CaptureScreen
import org.der.android.feature.capture.EventNewScreen
import org.der.android.feature.capture.TrackerSearchScreen
import org.der.android.feature.dashboard.DashboardScreen
import org.der.android.feature.dataentry.AggregateFormScreen
import org.der.android.feature.dataentry.DataEntryScreen
import org.der.android.feature.devices.DevicesScreen
import org.der.android.feature.devices.EnrolmentScreen
import org.der.android.feature.settings.SettingsScreen
import org.der.android.feature.workflow.WorkflowRunScreen
import org.der.android.feature.workflow.WorkflowScreen
import org.der.android.ui.home.HomeScreen
import org.der.android.ui.peers.PeersScreen
import org.der.android.ui.signin.SignInScreen
import org.der.android.ui.sync.SyncScreen

/**
 * Root nav graph. Picks the start destination off the session state
 * so a cold start with a cached session skips SignIn.
 */
@Composable
fun DerApp(viewModel: SessionGateViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    when (val s = state) {
        SessionGateViewModel.State.Loading -> SplashBox()
        is SessionGateViewModel.State.Ready -> {
            val nav = rememberNavController()
            val start = if (s.authenticated) DerRoute.Home.path else DerRoute.SignIn.path
            NavHost(navController = nav, startDestination = start) {
                composable(DerRoute.SignIn.path) {
                    SignInScreen(
                        onSignedIn = { nav.replaceWith(DerRoute.Home) },
                        onDeviceNotApproved = { nav.replaceWith(DerRoute.Enrolment) },
                    )
                }
                composable(DerRoute.Enrolment.path) {
                    EnrolmentScreen(
                        onApproved = { nav.replaceWith(DerRoute.Home) },
                        onSignedOut = { nav.replaceWith(DerRoute.SignIn) },
                    )
                }
                composable(DerRoute.Home.path) {
                    HomeScreen(
                        onNavigate = { route -> nav.navigate(route) },
                        onSignedOut = { nav.replaceWith(DerRoute.SignIn) },
                    )
                }
                composable(DerRoute.DataEntry.path) {
                    DataEntryScreen(
                        onOpen = { id -> nav.navigate(DerRoute.DataEntryForm.pathFor(id)) },
                    )
                }
                composable(
                    route = DerRoute.DataEntryForm.pattern,
                    arguments = listOf(navArgument("id") { type = NavType.StringType }),
                ) {
                    AggregateFormScreen(onSaved = { nav.popBackStack() })
                }
                composable(DerRoute.Capture.path) {
                    CaptureScreen(
                        onOpen = { programId, type ->
                            val route = when (type) {
                                ProgramType.WITH_REGISTRATION ->
                                    DerRoute.TrackerSearch.pathFor(programId)
                                ProgramType.WITHOUT_REGISTRATION ->
                                    DerRoute.EventNew.pathFor(programId)
                            }
                            nav.navigate(route)
                        },
                    )
                }
                composable(
                    route = DerRoute.TrackerSearch.pattern,
                    arguments = listOf(navArgument("programId") { type = NavType.StringType }),
                ) { TrackerSearchScreen() }
                composable(
                    route = DerRoute.EventNew.pattern,
                    arguments = listOf(navArgument("programId") { type = NavType.StringType }),
                ) { EventNewScreen(onSaved = { nav.popBackStack() }) }
                composable(DerRoute.Workflow.path) {
                    WorkflowScreen(
                        onOpenStep = { runId, stepId ->
                            nav.navigate(DerRoute.WorkflowRun.pathFor(runId, stepId))
                        },
                    )
                }
                composable(
                    route = DerRoute.WorkflowRun.pattern,
                    arguments = listOf(
                        navArgument("runId") { type = NavType.StringType },
                        navArgument("stepId") { type = NavType.StringType },
                    ),
                ) { WorkflowRunScreen(onDone = { nav.popBackStack() }) }
                composable(DerRoute.Dashboard.path) { DashboardScreen() }
                composable(DerRoute.Approvals.path) { ApprovalsScreen() }
                composable(DerRoute.Peers.path) { PeersScreen() }
                composable(DerRoute.Sync.path) { SyncScreen() }
                composable(DerRoute.Devices.path) { DevicesScreen() }
                composable(DerRoute.Settings.path) { SettingsScreen() }
            }
        }
    }
}

/** Navigate to [route], clearing the current destination from the back stack. */
private fun NavController.replaceWith(route: DerRoute) {
    val current = currentDestination?.route
    navigate(route.path) {
        if (current != null) popUpTo(current) { inclusive = true }
    }
}

@Composable
private fun SplashBox() {
    Surface(modifier = Modifier.fillMaxSize()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    }
}

sealed class DerRoute(val path: String) {
    data object SignIn : DerRoute("sign-in")
    data object Enrolment : DerRoute("enrolment")
    data object Home : DerRoute("home")

    // Launcher tile destinations — paths match [LauncherTile.route].
    data object DataEntry : DerRoute("data-entry")
    data object DataEntryForm : DerRoute("data-entry/{id}") {
        const val pattern = "data-entry/{id}"
        fun pathFor(id: String) = "data-entry/$id"
    }
    data object Capture : DerRoute("capture")
    data object TrackerSearch : DerRoute("capture/tracker/{programId}") {
        const val pattern = "capture/tracker/{programId}"
        fun pathFor(programId: String) = "capture/tracker/$programId"
    }
    data object EventNew : DerRoute("capture/event/{programId}") {
        const val pattern = "capture/event/{programId}"
        fun pathFor(programId: String) = "capture/event/$programId"
    }
    data object Workflow : DerRoute("workflow")
    data object WorkflowRun : DerRoute("workflow/{runId}/{stepId}") {
        const val pattern = "workflow/{runId}/{stepId}"
        fun pathFor(runId: String, stepId: String) = "workflow/$runId/$stepId"
    }
    data object Dashboard : DerRoute("dashboard")
    data object Approvals : DerRoute("approvals")
    data object Peers : DerRoute("peers")
    data object Sync : DerRoute("sync")
    data object Devices : DerRoute("devices")
    data object Settings : DerRoute("settings")
}
