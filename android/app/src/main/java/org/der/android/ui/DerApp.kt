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
import org.der.android.feature.capture.EventListScreen
import org.der.android.feature.capture.EventNewScreen
import org.der.android.feature.capture.TeiDetailScreen
import org.der.android.feature.capture.TrackerEnrolScreen
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
fun DerApp(
    initialDeepLink: String? = null,
    viewModel: SessionGateViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    when (val s = state) {
        SessionGateViewModel.State.Loading -> SplashBox()
        is SessionGateViewModel.State.Ready -> {
            val nav = rememberNavController()
            val start = when (s.start) {
                SessionGateViewModel.Start.SIGN_IN -> DerRoute.SignIn.path
                SessionGateViewModel.Start.UNLOCK -> DerRoute.Unlock.path
                SessionGateViewModel.Start.HOME -> DerRoute.Home.path
            }
            // Honor cold-start deep-link once the nav graph is set
            // up. We pin the launcher at Home first so Back still
            // goes to a sensible place.
            androidx.compose.runtime.LaunchedEffect(initialDeepLink, start) {
                if (!initialDeepLink.isNullOrBlank()
                    && start == DerRoute.Home.path
                    && initialDeepLink in DEEP_LINK_ALLOW) {
                    nav.navigate(initialDeepLink)
                }
            }
            NavHost(navController = nav, startDestination = start) {
                composable(DerRoute.SignIn.path) {
                    SignInScreen(
                        onSignedIn = { nav.replaceWith(DerRoute.Home) },
                        onDeviceNotApproved = { nav.replaceWith(DerRoute.Enrolment) },
                    )
                }
                composable(DerRoute.Unlock.path) {
                    org.der.android.ui.unlock.UnlockScreen(
                        onUnlocked = {
                            viewModel.markUnlocked()
                            nav.replaceWith(DerRoute.Home)
                        },
                        onSignOut = { nav.replaceWith(DerRoute.SignIn) },
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
                                    DerRoute.EventList.pathFor(programId)
                            }
                            nav.navigate(route)
                        },
                    )
                }
                composable(
                    route = DerRoute.TrackerSearch.pattern,
                    arguments = listOf(navArgument("programId") { type = NavType.StringType }),
                ) { backStackEntry ->
                    val programId = backStackEntry.arguments?.getString("programId").orEmpty()
                    val scanned by backStackEntry.savedStateHandle
                        .getStateFlow(SCAN_RESULT_KEY, "")
                        .collectAsStateWithLifecycle()
                    TrackerSearchScreen(
                        scanResult = scanned.takeIf { it.isNotBlank() },
                        onConsumeScanResult = {
                            backStackEntry.savedStateHandle[SCAN_RESULT_KEY] = ""
                        },
                        onEnrolNewPatient = {
                            nav.navigate(DerRoute.TrackerEnrol.pathFor(programId))
                        },
                        onOpenTei = { teiUid ->
                            nav.navigate(DerRoute.TeiDetail.pathFor(programId, teiUid))
                        },
                        onScanBarcode = {
                            nav.navigate(DerRoute.BarcodeScan.path)
                        },
                    )
                }
                composable(DerRoute.BarcodeScan.path) {
                    org.der.android.ui.scan.BarcodeScanScreen(
                        title = "Scan patient barcode",
                        onDecoded = { decoded ->
                            nav.previousBackStackEntry?.savedStateHandle
                                ?.set(SCAN_RESULT_KEY, decoded)
                            nav.popBackStack()
                        },
                        onDismiss = { nav.popBackStack() },
                    )
                }
                composable(
                    route = DerRoute.TrackerEnrol.pattern,
                    arguments = listOf(navArgument("programId") { type = NavType.StringType }),
                ) {
                    TrackerEnrolScreen(onEnrolled = { nav.popBackStack() })
                }
                composable(
                    route = DerRoute.TeiDetail.pattern,
                    arguments = listOf(
                        navArgument("programId") { type = NavType.StringType },
                        navArgument("teiUid") { type = NavType.StringType },
                    ),
                ) { backStackEntry ->
                    val programId = backStackEntry.arguments?.getString("programId").orEmpty()
                    TeiDetailScreen(
                        onAddStageEvent = {
                            nav.navigate(DerRoute.EventNew.pathFor(programId))
                        },
                    )
                }
                composable(
                    route = DerRoute.EventList.pattern,
                    arguments = listOf(navArgument("programId") { type = NavType.StringType }),
                ) { backStackEntry ->
                    val programId = backStackEntry.arguments?.getString("programId").orEmpty()
                    EventListScreen(
                        onNewEvent = { nav.navigate(DerRoute.EventNew.pathFor(programId)) },
                        onOpenEvent = { eventUid ->
                            nav.navigate(DerRoute.EventEdit.pathFor(programId, eventUid))
                        },
                    )
                }
                composable(
                    route = DerRoute.EventNew.pattern,
                    arguments = listOf(navArgument("programId") { type = NavType.StringType }),
                ) { EventNewScreen(onSaved = { nav.popBackStack() }) }
                composable(
                    route = DerRoute.EventEdit.pattern,
                    arguments = listOf(
                        navArgument("programId") { type = NavType.StringType },
                        navArgument("eventUid") { type = NavType.StringType },
                    ),
                ) { EventNewScreen(onSaved = { nav.popBackStack() }) }
                composable(DerRoute.Workflow.path) {
                    WorkflowScreen(
                        onOpenStep = { runId, stepId ->
                            nav.navigate(DerRoute.WorkflowRun.pathFor(runId, stepId))
                        },
                        onOpenHistory = { runId ->
                            nav.navigate(DerRoute.WorkflowContributions.pathFor(runId))
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
                composable(
                    route = DerRoute.WorkflowContributions.pattern,
                    arguments = listOf(
                        navArgument("runId") { type = NavType.StringType },
                    ),
                ) { org.der.android.feature.workflow.WorkflowContributionsScreen() }
                composable(DerRoute.Dashboard.path) { DashboardScreen() }
                composable(DerRoute.Approvals.path) { ApprovalsScreen() }
                composable(DerRoute.Peers.path) { PeersScreen() }
                composable(DerRoute.Sync.path) { SyncScreen() }
                composable(DerRoute.Devices.path) { DevicesScreen() }
                composable(DerRoute.Settings.path) {
                    val context = androidx.compose.ui.platform.LocalContext.current
                    SettingsScreen(
                        onWiped = { nav.replaceWith(DerRoute.SignIn) },
                        onFeedback = { payload ->
                            org.der.android.ui.settings.FeedbackComposer.launch(
                                context = context,
                                appVersion = payload.appVersion,
                                deviceId = payload.deviceId,
                                userAgent = payload.userAgent,
                                username = payload.username,
                                pendingCaptures = payload.pendingCaptures,
                                serverUrl = payload.serverUrl,
                            )
                        },
                        onScanQr = { nav.navigate(DerRoute.QrScan.path) },
                    )
                }
                composable(DerRoute.QrScan.path) {
                    val vm: org.der.android.ui.qr.QrScanViewModel = hiltViewModel()
                    org.der.android.ui.qr.QrScanScreen(
                        onDecoded = { payload ->
                            vm.apply(payload)
                            nav.popBackStack()
                        },
                        onCancel = { nav.popBackStack() },
                    )
                }
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

/** Whitelist for notification-driven deep-link routes.
 *  Prevents a rogue intent from routing anywhere it pleases. */
private val DEEP_LINK_ALLOW = setOf(
    "workflow", "dashboard", "approvals", "sync", "capture", "data-entry",
)

/** Nav-level SavedStateHandle key for passing a scanned barcode
 *  back to the requesting screen. */
private const val SCAN_RESULT_KEY = "scanResult"

sealed class DerRoute(val path: String) {
    data object SignIn : DerRoute("sign-in")
    data object Unlock : DerRoute("unlock")
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
    data object TrackerEnrol : DerRoute("capture/tracker/{programId}/enrol") {
        const val pattern = "capture/tracker/{programId}/enrol"
        fun pathFor(programId: String) = "capture/tracker/$programId/enrol"
    }
    data object TeiDetail : DerRoute("capture/tracker/{programId}/tei/{teiUid}") {
        const val pattern = "capture/tracker/{programId}/tei/{teiUid}"
        fun pathFor(programId: String, teiUid: String) =
            "capture/tracker/$programId/tei/$teiUid"
    }
    data object EventList : DerRoute("capture/event/{programId}") {
        const val pattern = "capture/event/{programId}"
        fun pathFor(programId: String) = "capture/event/$programId"
    }
    data object EventNew : DerRoute("capture/event/{programId}/new") {
        const val pattern = "capture/event/{programId}/new"
        fun pathFor(programId: String) = "capture/event/$programId/new"
    }
    data object EventEdit : DerRoute("capture/event/{programId}/edit/{eventUid}") {
        const val pattern = "capture/event/{programId}/edit/{eventUid}"
        fun pathFor(programId: String, eventUid: String) =
            "capture/event/$programId/edit/$eventUid"
    }
    data object Workflow : DerRoute("workflow")
    data object WorkflowRun : DerRoute("workflow/{runId}/{stepId}") {
        const val pattern = "workflow/{runId}/{stepId}"
        fun pathFor(runId: String, stepId: String) = "workflow/$runId/$stepId"
    }
    data object WorkflowContributions : DerRoute("workflow/{runId}/history") {
        const val pattern = "workflow/{runId}/history"
        fun pathFor(runId: String) = "workflow/$runId/history"
    }
    data object Dashboard : DerRoute("dashboard")
    data object Approvals : DerRoute("approvals")
    data object Peers : DerRoute("peers")
    data object Sync : DerRoute("sync")
    data object Devices : DerRoute("devices")
    data object Settings : DerRoute("settings")
    data object QrScan : DerRoute("settings/qr-scan")
    data object BarcodeScan : DerRoute("scan")
}
