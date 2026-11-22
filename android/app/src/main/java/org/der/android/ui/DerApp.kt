package org.der.android.ui

import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import org.der.android.feature.devices.EnrolmentScreen
import org.der.android.ui.home.HomeScreen
import org.der.android.ui.signin.SignInScreen

/**
 * Root nav graph. Picks the start destination off the session state
 * so a cold start with a cached session skips the SignIn screen.
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
                        onSignedIn = {
                            nav.navigate(DerRoute.Home.path) {
                                popUpTo(DerRoute.SignIn.path) { inclusive = true }
                            }
                        },
                        onDeviceNotApproved = {
                            nav.navigate(DerRoute.Enrolment.path) {
                                popUpTo(DerRoute.SignIn.path) { inclusive = true }
                            }
                        },
                    )
                }
                composable(DerRoute.Enrolment.path) {
                    EnrolmentScreen(
                        onApproved = {
                            nav.navigate(DerRoute.Home.path) {
                                popUpTo(DerRoute.Enrolment.path) { inclusive = true }
                            }
                        },
                        onSignedOut = {
                            nav.navigate(DerRoute.SignIn.path) {
                                popUpTo(DerRoute.Enrolment.path) { inclusive = true }
                            }
                        },
                    )
                }
                composable(DerRoute.Home.path) {
                    HomeScreen(
                        onSignedOut = {
                            nav.navigate(DerRoute.SignIn.path) {
                                popUpTo(DerRoute.Home.path) { inclusive = true }
                            }
                        },
                    )
                }
            }
        }
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
}
