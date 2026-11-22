package org.der.android.ui

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import org.der.android.ui.home.HomeScreen
import org.der.android.ui.signin.SignInScreen

/**
 * Root navigation graph for the native Android client.
 *
 * Mirrors the web client's top-level routing (`client/src/App.tsx`):
 * `/sign-in` is the entry when there is no session; the shell under
 * `/*` houses Home + feature routes. The shell will expand screen by
 * screen in subsequent phases.
 */
@Composable
fun DerApp() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = DerRoute.SignIn.path) {
        composable(DerRoute.SignIn.path) {
            SignInScreen(
                onSignedIn = {
                    nav.navigate(DerRoute.Home.path) {
                        popUpTo(DerRoute.SignIn.path) { inclusive = true }
                    }
                },
            )
        }
        composable(DerRoute.Home.path) {
            HomeScreen()
        }
    }
}

sealed class DerRoute(val path: String) {
    data object SignIn : DerRoute("sign-in")
    data object Home : DerRoute("home")
}
