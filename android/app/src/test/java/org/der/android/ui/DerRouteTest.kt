package org.der.android.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Smoke test that confirms the Gradle + Kotlin + JUnit wiring works
 * for the app module. Replaces the "Hello, World!" tradition.
 */
class DerRouteTest {
    @Test fun signInPath() {
        assertEquals("sign-in", DerRoute.SignIn.path)
    }

    @Test fun homePath() {
        assertEquals("home", DerRoute.Home.path)
    }
}
